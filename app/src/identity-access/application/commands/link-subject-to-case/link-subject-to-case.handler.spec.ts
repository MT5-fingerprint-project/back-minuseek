import { InMemorySubjectRepository } from '../../../infrastructure/persistence/in-memory-subject.repository';
import { InMemorySubjectCaseRepository } from '../../../infrastructure/persistence/in-memory-subject-case.repository';
import { Subject } from '../../../domain/subject/entity/subject';
import { Sex } from '../../../domain/subject/value-objects/sex.vo';
import { SubjectTypeEnum } from '../../../domain/subject-case/value-objects/subject-type.vo';
import { SubjectNotFoundError } from '../../../domain/subject/errors/subject-not-found.error';
import { SubjectAlreadyLinkedToCaseError } from '../../../domain/subject-case/errors/subject-already-linked-to-case.error';
import { IdGenerator } from '../../../../shared/domain/ports/id-generator';
import { LinkSubjectToCaseCommand } from './link-subject-to-case.command';
import { LinkSubjectToCaseHandler } from './link-subject-to-case.handler';

class FixedIdGenerator implements IdGenerator {
  constructor(private readonly id: string) {}
  generate(): string {
    return this.id;
  }
}

const makeSubject = (id: string) =>
  Subject.register({
    id,
    firstName: 'Jean',
    lastName: 'Dupont',
    birthDate: new Date('1990-05-14'),
    birthPlace: 'Lyon',
    sex: Sex.male(),
  });

describe('LinkSubjectToCaseHandler', () => {
  let subjectRepo: InMemorySubjectRepository;
  let subjectCaseRepo: InMemorySubjectCaseRepository;
  let handler: LinkSubjectToCaseHandler;

  beforeEach(() => {
    subjectRepo = new InMemorySubjectRepository();
    subjectCaseRepo = new InMemorySubjectCaseRepository();
    handler = new LinkSubjectToCaseHandler(
      subjectRepo,
      subjectCaseRepo,
      new FixedIdGenerator('link-1'),
    );
  });

  it('rattache un sujet existant à une affaire et retourne son id', async () => {
    await subjectRepo.save(makeSubject('subject-1'));

    const id = await handler.execute(
      new LinkSubjectToCaseCommand(
        'subject-1',
        'case-2',
        SubjectTypeEnum.KNOWN_ASSOCIATE,
      ),
    );

    expect(id).toBe('subject-1');
    const link = subjectCaseRepo.store.get('link-1');
    expect(link?.subjectId).toBe('subject-1');
    expect(link?.caseId).toBe('case-2');
    expect(link?.type.getValue()).toBe(SubjectTypeEnum.KNOWN_ASSOCIATE);
  });

  it('refuse un sujet inconnu', async () => {
    await expect(
      handler.execute(
        new LinkSubjectToCaseCommand(
          'inconnu',
          'case-2',
          SubjectTypeEnum.SUSPECT,
        ),
      ),
    ).rejects.toBeInstanceOf(SubjectNotFoundError);
  });

  it('refuse un sujet déjà rattaché à cette affaire', async () => {
    await subjectRepo.save(makeSubject('subject-1'));
    await handler.execute(
      new LinkSubjectToCaseCommand(
        'subject-1',
        'case-2',
        SubjectTypeEnum.SUSPECT,
      ),
    );

    await expect(
      handler.execute(
        new LinkSubjectToCaseCommand(
          'subject-1',
          'case-2',
          SubjectTypeEnum.SUSPECT,
        ),
      ),
    ).rejects.toBeInstanceOf(SubjectAlreadyLinkedToCaseError);
  });
});
