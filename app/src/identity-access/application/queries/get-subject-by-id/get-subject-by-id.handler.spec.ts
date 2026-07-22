import { GetSubjectByIdHandler } from './get-subject-by-id.handler';
import { GetSubjectByIdQuery } from './get-subject-by-id.query';
import { InMemorySubjectReader } from '../../../infrastructure/persistence/in-memory-subject.reader';
import { SubjectReadModel } from './subject-read-model';
import { SubjectNotFoundError } from '../../../domain/subject/errors/subject-not-found.error';

const makeSubject = (
  overrides: Partial<SubjectReadModel> = {},
): SubjectReadModel => ({
  id: 'subject-1',
  firstName: 'Marie',
  lastName: 'Curie',
  birthDate: new Date('1990-05-14'),
  birthPlace: 'Paris',
  firstParentName: null,
  secondParentName: null,
  phoneNumber: null,
  sex: 'FEMALE',
  color: null,
  cases: [{ caseId: 'case-1', type: 'KNOWN_ASSOCIATE' }],
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
  ...overrides,
});

describe('GetSubjectByIdHandler', () => {
  let handler: GetSubjectByIdHandler;
  let reader: InMemorySubjectReader;

  beforeEach(() => {
    reader = new InMemorySubjectReader();
    handler = new GetSubjectByIdHandler(reader);
  });

  it('retourne le sujet correspondant à son id', async () => {
    reader.store.push(makeSubject({ id: 'subject-1' }));
    reader.store.push(makeSubject({ id: 'subject-2', firstName: 'Paul' }));

    const subject = await handler.execute(new GetSubjectByIdQuery('subject-2'));

    expect(subject.id).toBe('subject-2');
    expect(subject.firstName).toBe('Paul');
  });

  it('lève une SubjectNotFoundError si aucun sujet ne correspond', async () => {
    await expect(
      handler.execute(new GetSubjectByIdQuery('inconnu')),
    ).rejects.toThrow(SubjectNotFoundError);
  });
});
