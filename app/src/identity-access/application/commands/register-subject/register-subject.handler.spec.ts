import { EXPERT_ACTOR } from '../../../../shared/domain/audit/audit-actor.fixture';
import { AuditEventTypeEnum } from '../../../../shared/domain/audit/audit-event-type.vo';
import { EvidenceClassEnum } from '../../../../shared/domain/audit/evidence-class.vo';
import { InMemoryAuditTrailAppender } from '../../../../audit-trail/infrastructure/persistence/in-memory-audit-trail.appender';
import { InMemorySubjectRepository } from '../../../infrastructure/persistence/in-memory-subject.repository';
import { SexEnum } from '../../../domain/subject/value-objects/sex.vo';
import { SubjectTypeEnum } from '../../../domain/subject/value-objects/subject-type.vo';
import { IdGenerator } from '../../../../shared/domain/ports/id-generator';
import { RegisterSubjectCommand } from './register-subject.command';
import { RegisterSubjectHandler } from './register-subject.handler';

class FixedIdGenerator implements IdGenerator {
  constructor(private readonly id: string) {}
  generate(): string {
    return this.id;
  }
}

const buildCommand = (overrides: Partial<RegisterSubjectCommand> = {}) =>
  new RegisterSubjectCommand(
    EXPERT_ACTOR,
    overrides.firstName ?? 'Jean',
    overrides.lastName ?? 'Dupont',
    'birthDate' in overrides ? overrides.birthDate! : new Date('1990-05-14'),
    'birthPlace' in overrides ? overrides.birthPlace! : 'Lyon',
    overrides.sex ?? SexEnum.MALE,
    overrides.caseId ?? 'case-1',
    overrides.type ?? SubjectTypeEnum.PERSON_OF_INTEREST,
    overrides.firstParentName ?? 'Paul Dupont',
    overrides.secondParentName ?? 'Anne Dupont',
    overrides.phoneNumber ?? '+33612345678',
    overrides.color ?? '#FF5733',
  );

describe('RegisterSubjectHandler', () => {
  let repo: InMemorySubjectRepository;
  let auditTrail: InMemoryAuditTrailAppender;
  let handler: RegisterSubjectHandler;

  beforeEach(() => {
    auditTrail = new InMemoryAuditTrailAppender();
    repo = new InMemorySubjectRepository(auditTrail);
    handler = new RegisterSubjectHandler(
      repo,
      new FixedIdGenerator('subject-1'),
    );
  });

  const stored = () => repo.store.get('subject-1');

  it('enregistre un sujet rattaché à son affaire et retourne son id', async () => {
    const id = await handler.execute(buildCommand());

    expect(id).toBe('subject-1');
    expect(stored()?.firstName).toBe('Jean');
    expect(stored()?.caseId).toBe('case-1');
    expect(stored()?.sex.getValue()).toBe(SexEnum.MALE);
    expect(stored()?.type.getValue()).toBe(SubjectTypeEnum.PERSON_OF_INTEREST);
    expect(stored()?.color).toBe('#FF5733');
  });

  it('normalise les champs optionnels vides en null', async () => {
    await handler.execute(
      buildCommand({ firstParentName: '  ', phoneNumber: '   ' }),
    );

    expect(stored()?.firstParentName).toBeNull();
    expect(stored()?.phoneNumber).toBeNull();
  });

  it('rejette un sexe invalide sans rien écrire ni chaîner', async () => {
    await expect(handler.execute(buildCommand({ sex: 'X' }))).rejects.toThrow(
      /sexe/,
    );
    expect(repo.store.size).toBe(0);
    expect(auditTrail.events).toHaveLength(0);
  });

  describe('la victime, troisième type de personne du dossier', () => {
    const aVictim = () =>
      buildCommand({
        firstName: 'Hélène',
        lastName: 'BERGER',
        sex: SexEnum.FEMALE,
        type: SubjectTypeEnum.VICTIM,
        birthDate: null,
        birthPlace: null,
      });

    it('enregistre une victime sans date ni lieu de naissance', async () => {
      await handler.execute(aVictim());

      expect(stored()?.type.getValue()).toBe(SubjectTypeEnum.VICTIM);
      expect(stored()?.birthDate).toBeNull();
      expect(stored()?.birthPlace).toBeNull();
    });

    it('enregistre un familier sans date ni lieu de naissance non plus', async () => {
      await handler.execute(
        buildCommand({
          type: SubjectTypeEnum.CLOSE_ASSOCIATE,
          birthDate: null,
          birthPlace: null,
        }),
      );

      expect(stored()?.birthDate).toBeNull();
      expect(stored()?.birthPlace).toBeNull();
    });
  });

  describe("l'acte de déclaration", () => {
    it('inscrit un SUBJECT_REGISTERED par déclaration réussie', async () => {
      await handler.execute(buildCommand());

      expect(auditTrail.events).toHaveLength(1);
      const [event] = auditTrail.events;
      expect(event.eventType).toBe(AuditEventTypeEnum.SUBJECT_REGISTERED);
      expect(event.evidenceClass).toBe(EvidenceClassEnum.OBSERVED);
      expect(event.actor).toEqual(EXPERT_ACTOR.toPrimitives());
      expect(event.caseId).toBe('case-1');
    });

    it('porte le nom complet et le type pour un mis en cause', async () => {
      await handler.execute(
        buildCommand({ firstName: 'Hélène', lastName: 'BERGER' }),
      );

      expect(auditTrail.events[0].payload).toStrictEqual({
        designation: 'BERGER Hélène',
        sex: SexEnum.MALE,
        type: SubjectTypeEnum.PERSON_OF_INTEREST,
      });
    });

    it('porte le nom complet pour un familier aussi', async () => {
      await handler.execute(
        buildCommand({
          firstName: 'Hélène',
          lastName: 'BERGER',
          type: SubjectTypeEnum.CLOSE_ASSOCIATE,
        }),
      );

      expect(auditTrail.events[0].payload).toStrictEqual({
        designation: 'BERGER Hélène',
        sex: SexEnum.MALE,
        type: SubjectTypeEnum.CLOSE_ASSOCIATE,
      });
    });

    it("n'écrit d'une victime que sa désignation abrégée", async () => {
      await handler.execute(
        buildCommand({
          firstName: 'Hélène',
          lastName: 'BERGER',
          sex: SexEnum.FEMALE,
          type: SubjectTypeEnum.VICTIM,
          birthDate: new Date('1958-09-04'),
        }),
      );

      // Cherchées dans le payload sérialisé, pas comparées à un objet : la
      // formulation tient si quelqu'un ajoute un champ plus tard.
      const serialized = JSON.stringify(auditTrail.events[0].payload);
      expect(serialized).toContain('Hélène B.');
      expect(serialized).not.toContain('BERGER');
      expect(serialized).not.toContain('1958');
      expect(serialized).not.toMatch(/\d/);
    });
  });
});
