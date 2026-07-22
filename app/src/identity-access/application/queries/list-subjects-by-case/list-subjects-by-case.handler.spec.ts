import { ListSubjectsByCaseHandler } from './list-subjects-by-case.handler';
import { ListSubjectsByCaseQuery } from './list-subjects-by-case.query';
import { CaseSubjectReadModel } from './case-subject-read-model';
import { CaseSubjectsReader } from './case-subjects.reader';

class InMemoryCaseSubjectsReader implements CaseSubjectsReader {
  readonly store: Array<{ caseId: string; subject: CaseSubjectReadModel }> = [];

  findByCaseId(caseId: string): Promise<CaseSubjectReadModel[]> {
    return Promise.resolve(
      this.store.filter((s) => s.caseId === caseId).map((s) => s.subject),
    );
  }
}

const makeEntry = (
  caseId: string,
  overrides: Partial<CaseSubjectReadModel> = {},
): { caseId: string; subject: CaseSubjectReadModel } => ({
  caseId,
  subject: {
    id: 'subject-1',
    firstName: 'Jean',
    lastName: 'Dupont',
    birthDate: new Date('1990-05-14'),
    birthPlace: 'Lyon',
    firstParentName: null,
    secondParentName: null,
    phoneNumber: null,
    sex: 'MALE',
    color: null,
    type: 'SUSPECT',
    createdAt: new Date('2026-01-01'),
    ...overrides,
  },
});

describe('ListSubjectsByCaseHandler', () => {
  let handler: ListSubjectsByCaseHandler;
  let reader: InMemoryCaseSubjectsReader;

  beforeEach(() => {
    reader = new InMemoryCaseSubjectsReader();
    handler = new ListSubjectsByCaseHandler(reader);
  });

  it("retourne les sujets rattachés à l'affaire", async () => {
    reader.store.push(makeEntry('case-1', { id: 'subject-1' }));
    reader.store.push(
      makeEntry('case-1', { id: 'subject-2', type: 'KNOWN_ASSOCIATE' }),
    );
    reader.store.push(makeEntry('case-2', { id: 'subject-3' }));

    const { data } = await handler.execute(
      new ListSubjectsByCaseQuery('case-1'),
    );

    expect(data).toHaveLength(2);
    expect(data.map((s) => s.id)).toEqual(['subject-1', 'subject-2']);
    expect(data[1].type).toBe('KNOWN_ASSOCIATE');
  });

  it("retourne une liste vide si l'affaire n'a aucun sujet", async () => {
    const { data } = await handler.execute(
      new ListSubjectsByCaseQuery('case-vide'),
    );

    expect(data).toEqual([]);
  });
});
