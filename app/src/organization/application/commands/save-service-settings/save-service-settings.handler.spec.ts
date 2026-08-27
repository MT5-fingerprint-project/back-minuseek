import { EXPERT_ACTOR } from '../../../../shared/domain/audit/audit-actor.fixture';
import { AuditEventTypeEnum } from '../../../../shared/domain/audit/audit-event-type.vo';
import { EvidenceClassEnum } from '../../../../shared/domain/audit/evidence-class.vo';
import { InMemoryAuditTrailAppender } from '../../../../audit-trail/infrastructure/persistence/in-memory-audit-trail.appender';
import { UserRoleEnum } from '../../../../identity-access/domain/user/value-objects/user-role.vo';
import { ServiceLetterhead } from '../../../domain/service-settings/entity/service-settings';
import { ServiceSettingsAdministrationNotAllowedError } from '../../../domain/service-settings/errors/service-settings-administration-not-allowed.error';
import { InMemoryServiceSettingsRepository } from '../../../infrastructure/persistence/in-memory-service-settings.repository';
import { SaveServiceSettingsCommand } from './save-service-settings.command';
import { SaveServiceSettingsHandler } from './save-service-settings.handler';

const CHEF = { id: 'user-chef', role: UserRoleEnum.ADMIN };

const SRPTS: ServiceLetterhead = {
  administration:
    "MINISTÈRE DE L'INTÉRIEUR — DIRECTION GÉNÉRALE DE LA POLICE NATIONALE",
  serviceName: 'SERVICE RÉGIONAL DE POLICE TECHNIQUE ET SCIENTIFIQUE',
  postalAddress: '36 rue du Bastion — 75017 PARIS',
  phoneNumber: '01 40 79 60 00',
  email: 'srpts.paris@interieur.gouv.fr',
  signatureCity: 'Paris',
};

function build() {
  const auditTrail = new InMemoryAuditTrailAppender();
  const repo = new InMemoryServiceSettingsRepository(auditTrail);
  return { repo, auditTrail, handler: new SaveServiceSettingsHandler(repo) };
}

const commandFor = (
  letterhead: Partial<ServiceLetterhead> = {},
  requester = CHEF,
) =>
  new SaveServiceSettingsCommand(EXPERT_ACTOR, requester, {
    ...SRPTS,
    ...letterhead,
  });

async function storedLetterhead(
  repo: InMemoryServiceSettingsRepository,
): Promise<ServiceLetterhead | null> {
  const settings = await repo.find();
  return settings ? settings.toPrimitives() : null;
}

describe('SaveServiceSettingsHandler', () => {
  it("enregistre l'en-tête, que le service relit à l'identique", async () => {
    const { handler, repo } = build();

    await handler.execute(commandFor());

    expect(await storedLetterhead(repo)).toEqual(SRPTS);
  });

  it('laisse un acte qui porte les six champs au premier enregistrement', async () => {
    const { handler, auditTrail } = build();

    await handler.execute(commandFor());

    expect(auditTrail.events).toHaveLength(1);
    expect(auditTrail.events[0]).toMatchObject({
      eventType: AuditEventTypeEnum.SERVICE_HEADER_SAVED,
      evidenceClass: EvidenceClassEnum.OBSERVED,
      caseId: null,
      traceId: null,
      payload: { changes: SRPTS },
    });
  });

  it("attribue l'acte à l'auteur de la commande", async () => {
    const { handler, auditTrail } = build();

    await handler.execute(commandFor());

    expect(auditTrail.events[0].actor).toEqual(EXPERT_ACTOR.toPrimitives());
  });

  it('ne journalise que le champ corrigé au second enregistrement', async () => {
    const { handler, auditTrail } = build();
    await handler.execute(commandFor());

    await handler.execute(commandFor({ signatureCity: 'Lyon' }));

    expect(auditTrail.events).toHaveLength(2);
    expect(auditTrail.events[1].payload).toEqual({
      changes: { signatureCity: 'Lyon' },
    });
  });

  it('journalise la valeur vide du champ que le responsable efface', async () => {
    const { handler, auditTrail } = build();
    await handler.execute(commandFor());

    await handler.execute(commandFor({ phoneNumber: '' }));

    expect(auditTrail.events[1].payload).toEqual({
      changes: { phoneNumber: '' },
    });
  });

  it('remplace les valeurs sans en garder de trace, au second enregistrement', async () => {
    const { handler, repo } = build();
    await handler.execute(commandFor());

    await handler.execute(commandFor({ signatureCity: 'Lyon' }));

    expect(await storedLetterhead(repo)).toEqual({
      ...SRPTS,
      signatureCity: 'Lyon',
    });
  });

  it("n'enregistre rien et ne journalise rien quand rien ne change", async () => {
    const { handler, auditTrail } = build();
    await handler.execute(commandFor());

    await handler.execute(commandFor());

    expect(auditTrail.events).toHaveLength(1);
  });

  it("n'enregistre rien quand seuls les espaces de bord changent", async () => {
    const { handler, auditTrail } = build();
    await handler.execute(commandFor());

    await handler.execute(
      commandFor({ serviceName: `  ${SRPTS.serviceName} ` }),
    );

    expect(auditTrail.events).toHaveLength(1);
  });

  it('enregistre et journalise des valeurs déjà débarrassées de leurs espaces', async () => {
    const { handler, repo, auditTrail } = build();

    await handler.execute(commandFor({ signatureCity: '  Paris  ' }));

    expect((await storedLetterhead(repo))!.signatureCity).toBe('Paris');
    expect(auditTrail.events[0].payload).toEqual({ changes: SRPTS });
  });

  it('accepte un en-tête entièrement vide sans le journaliser, faute de changement', async () => {
    const { handler, repo, auditTrail } = build();

    await handler.execute(
      commandFor({
        administration: '',
        serviceName: '',
        postalAddress: '',
        phoneNumber: '',
        email: '',
        signatureCity: '',
      }),
    );

    expect(await storedLetterhead(repo)).toBeNull();
    expect(auditTrail.events).toEqual([]);
  });

  it.each([UserRoleEnum.OPERATOR, UserRoleEnum.EXPERT])(
    'refuse un appelant %s, sans rien enregistrer ni journaliser',
    async (role) => {
      const { handler, repo, auditTrail } = build();

      await expect(
        handler.execute(commandFor({}, { id: 'user-marie', role })),
      ).rejects.toThrow(ServiceSettingsAdministrationNotAllowedError);
      expect(await storedLetterhead(repo)).toBeNull();
      expect(auditTrail.events).toEqual([]);
    },
  );

  it("refuse un opérateur qui réenregistre l'en-tête à l'identique", async () => {
    const { handler, auditTrail } = build();
    await handler.execute(commandFor());

    await expect(
      handler.execute(
        commandFor({}, { id: 'user-marie', role: UserRoleEnum.OPERATOR }),
      ),
    ).rejects.toThrow(ServiceSettingsAdministrationNotAllowedError);
    expect(auditTrail.events).toHaveLength(1);
  });

  it("refuse un opérateur même quand l'en-tête est déjà rempli", async () => {
    const { handler, repo, auditTrail } = build();
    await handler.execute(commandFor());

    await expect(
      handler.execute(
        commandFor(
          { signatureCity: 'Lyon' },
          { id: 'user-marie', role: UserRoleEnum.OPERATOR },
        ),
      ),
    ).rejects.toThrow(ServiceSettingsAdministrationNotAllowedError);
    expect((await storedLetterhead(repo))!.signatureCity).toBe('Paris');
    expect(auditTrail.events).toHaveLength(1);
  });
});
