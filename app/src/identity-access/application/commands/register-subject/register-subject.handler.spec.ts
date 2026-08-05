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
    overrides.firstName ?? 'Jean',
    overrides.lastName ?? 'Dupont',
    overrides.birthDate ?? new Date('1990-05-14'),
    overrides.birthPlace ?? 'Lyon',
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
  let handler: RegisterSubjectHandler;

  beforeEach(() => {
    repo = new InMemorySubjectRepository();
    handler = new RegisterSubjectHandler(
      repo,
      new FixedIdGenerator('subject-1'),
    );
  });

  it('enregistre un sujet rattaché à son affaire et retourne son id', async () => {
    const id = await handler.execute(buildCommand());

    expect(id).toBe('subject-1');
    const stored = repo.store.get('subject-1');
    expect(stored?.firstName).toBe('Jean');
    expect(stored?.caseId).toBe('case-1');
    expect(stored?.sex.getValue()).toBe(SexEnum.MALE);
    expect(stored?.type.getValue()).toBe(SubjectTypeEnum.PERSON_OF_INTEREST);
    expect(stored?.color).toBe('#FF5733');
  });

  it('normalise les champs optionnels vides en null', async () => {
    await handler.execute(
      buildCommand({ firstParentName: '  ', phoneNumber: '   ' }),
    );

    const stored = repo.store.get('subject-1');
    expect(stored?.firstParentName).toBeNull();
    expect(stored?.phoneNumber).toBeNull();
  });

  it('rejette un sexe invalide', async () => {
    await expect(handler.execute(buildCommand({ sex: 'X' }))).rejects.toThrow();
  });
});
