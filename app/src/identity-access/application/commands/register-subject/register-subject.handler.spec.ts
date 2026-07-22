import { InMemorySubjectRepository } from '../../../infrastructure/persistence/in-memory-subject.repository';
import { InMemorySubjectCaseRepository } from '../../../infrastructure/persistence/in-memory-subject-case.repository';
import { SexEnum } from '../../../domain/subject/value-objects/sex.vo';
import { SubjectTypeEnum } from '../../../domain/subject-case/value-objects/subject-type.vo';
import { IdGenerator } from '../../../../shared/domain/ports/id-generator';
import { RegisterSubjectCommand } from './register-subject.command';
import { RegisterSubjectHandler } from './register-subject.handler';

class SequentialIdGenerator implements IdGenerator {
  private index = 0;
  constructor(private readonly ids: string[]) {}
  generate(): string {
    return this.ids[this.index++] ?? `id-${this.index}`;
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
    overrides.type ?? SubjectTypeEnum.SUSPECT,
    overrides.firstParentName ?? 'Paul Dupont',
    overrides.secondParentName ?? 'Anne Dupont',
    overrides.phoneNumber ?? '+33612345678',
    overrides.color ?? '#FF5733',
  );

describe('RegisterSubjectHandler', () => {
  let subjectRepo: InMemorySubjectRepository;
  let subjectCaseRepo: InMemorySubjectCaseRepository;
  let handler: RegisterSubjectHandler;

  beforeEach(() => {
    subjectRepo = new InMemorySubjectRepository();
    subjectCaseRepo = new InMemorySubjectCaseRepository();
    handler = new RegisterSubjectHandler(
      subjectRepo,
      subjectCaseRepo,
      new SequentialIdGenerator(['subject-1', 'link-1']),
    );
  });

  it('crée le sujet et le rattache à l’affaire', async () => {
    const id = await handler.execute(buildCommand());

    expect(id).toBe('subject-1');
    const stored = subjectRepo.store.get('subject-1');
    expect(stored?.firstName).toBe('Jean');
    expect(stored?.sex.getValue()).toBe(SexEnum.MALE);
    expect(stored?.color).toBe('#FF5733');

    const link = subjectCaseRepo.store.get('link-1');
    expect(link?.subjectId).toBe('subject-1');
    expect(link?.caseId).toBe('case-1');
    expect(link?.type.getValue()).toBe(SubjectTypeEnum.SUSPECT);
  });

  it('normalise les champs optionnels vides en null', async () => {
    await handler.execute(
      buildCommand({ firstParentName: '  ', phoneNumber: '   ' }),
    );

    const stored = subjectRepo.store.get('subject-1');
    expect(stored?.firstParentName).toBeNull();
    expect(stored?.phoneNumber).toBeNull();
  });

  it('rejette un sexe invalide', async () => {
    await expect(handler.execute(buildCommand({ sex: 'X' }))).rejects.toThrow();
  });
});
