import { EXPERT_ACTOR } from '../../src/shared/domain/audit/audit-actor.fixture';
import { AuditEventTypeEnum } from '../../src/shared/domain/audit/audit-event-type.vo';
import { EvidenceClassEnum } from '../../src/shared/domain/audit/evidence-class.vo';
import { AuditEventDraft } from '../../src/shared/domain/ports/audit-trail.port';
import { ServiceSettings } from '../../src/organization/domain/service-settings/entity/service-settings';
import { PrismaServiceSettingsRepository } from '../../src/organization/infrastructure/persistence/prisma-service-settings.repository';
import { UnauditedMutationError } from '../../src/tenancy/infrastructure/persistence/unaudited-mutation.error';
import {
  AuditChainHarness,
  openAuditChainHarness,
} from './support/audit-chain-harness';

const SRPTS = {
  administration: "MINISTÈRE DE L'INTÉRIEUR — DGPN",
  serviceName: 'SERVICE RÉGIONAL DE POLICE TECHNIQUE ET SCIENTIFIQUE',
  postalAddress: '36 rue du Bastion — 75017 PARIS',
  phoneNumber: '01 40 79 60 00',
  email: 'srpts.paris@interieur.gouv.fr',
  signatureCity: 'Paris',
};

const headerSaved = (changes: Record<string, string>): AuditEventDraft => ({
  eventType: AuditEventTypeEnum.SERVICE_HEADER_SAVED,
  evidenceClass: EvidenceClassEnum.OBSERVED,
  actor: EXPERT_ACTOR,
  caseId: null,
  payload: { changes },
});

describe('réglages de service contre un vrai Postgres', () => {
  let harness: AuditChainHarness;
  let repository: PrismaServiceSettingsRepository;

  beforeAll(async () => {
    harness = await openAuditChainHarness();
    repository = new PrismaServiceSettingsRepository(
      harness.connection,
      harness.runner,
      harness.appender,
    );
  });

  afterAll(async () => {
    await harness.close();
  });

  beforeEach(async () => {
    await harness.database.reset();
  });

  function save(city: string, ...acts: AuditEventDraft[]): Promise<void> {
    return harness.asTenant(() =>
      repository.save(
        ServiceSettings.reconstitute({ ...SRPTS, signatureCity: city }),
        ...acts,
      ),
    );
  }

  it("ne laisse qu'une ligne, quel que soit le nombre d'enregistrements", async () => {
    await save('Paris', headerSaved(SRPTS));
    await save('Lyon', headerSaved({ signatureCity: 'Lyon' }));
    await save('Marseille', headerSaved({ signatureCity: 'Marseille' }));

    const rows = await harness.database.client.serviceSettings.findMany();
    expect(rows).toHaveLength(1);
    expect(rows[0].signatureCity).toBe('Marseille');
  });

  it('chaîne un acte rattaché à aucun dossier, qui porte le champ modifié et sa valeur', async () => {
    await save('Paris', headerSaved(SRPTS));
    await save('Lyon', headerSaved({ signatureCity: 'Lyon' }));

    const events = await harness.database.client.auditEvent.findMany({
      orderBy: { seq: 'asc' },
    });
    expect(events.map((event) => event.eventType)).toEqual([
      AuditEventTypeEnum.SERVICE_HEADER_SAVED,
      AuditEventTypeEnum.SERVICE_HEADER_SAVED,
    ]);
    expect(events.map((event) => event.caseId)).toEqual([null, null]);
    expect(events[1].payload).toEqual({ changes: { signatureCity: 'Lyon' } });
    expect(events[1].prevHash).toBe(events[0].hash);
  });

  it("refuse un enregistrement que personne n'a journalisé, et n'écrit rien", async () => {
    await expect(save('Paris')).rejects.toThrow(UnauditedMutationError);

    expect(await harness.database.client.serviceSettings.findMany()).toEqual(
      [],
    );
  });

  it("rend null tant que le service n'a rien saisi", async () => {
    expect(await harness.asTenant(() => repository.find())).toBeNull();
  });
});
