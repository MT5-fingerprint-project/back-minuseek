import { InMemoryImageStorageAdapter } from '../../../infrastructure/storage/in-memory-image-storage.adapter';
import { ListReferencePrintsHandler } from './list-reference-prints.handler';
import { ListReferencePrintsQuery } from './list-reference-prints.query';
import { ReferencePrintReadModel } from './reference-print-read-model';
import { ReferencePrintReader } from './reference-print.reader';

class InMemoryReferencePrintReader implements ReferencePrintReader {
  constructor(private readonly referencePrints: ReferencePrintReadModel[]) {}

  // Même ordre que `prisma-reference-print.reader.ts` : la plus récente
  // d'abord, puis l'identifiant pour départager deux versements simultanés.
  findByCaseId(
    caseId: string,
    withdrawn = false,
  ): Promise<ReferencePrintReadModel[]> {
    return Promise.resolve(
      this.referencePrints
        .filter(
          (referencePrint) =>
            referencePrint.caseId === caseId &&
            (referencePrint.withdrawnAt !== null) === withdrawn,
        )
        .sort(
          (left, right) =>
            right.createdAt.getTime() - left.createdAt.getTime() ||
            left.id.localeCompare(right.id),
        ),
    );
  }
}

describe('ListReferencePrintsHandler', () => {
  it('adds a url derived from the path to each reference print of the case', async () => {
    const reader = new InMemoryReferencePrintReader([
      {
        id: 'ref-1',
        path: 'media/investigation-case/case-9/reference-prints/ref-1.png',
        caseId: 'case-9',
        subjectId: null,
        position: null,
        createdAt: new Date('2026-07-01T00:00:00.000Z'),
        matchings: [],
        withdrawnAt: null,
        withdrawalMotive: null,
      },
    ]);
    const handler = new ListReferencePrintsHandler(
      reader,
      new InMemoryImageStorageAdapter(),
    );

    const { data } = await handler.execute(
      new ListReferencePrintsQuery('case-9'),
    );

    expect(data).toHaveLength(1);
    expect(data[0].url).toBe(
      '/media/investigation-case/case-9/reference-prints/ref-1.png',
    );
  });

  it('départage deux empreintes versées dans la même seconde par leur identifiant', async () => {
    const versedAt = new Date('2026-07-01T00:00:00.000Z');
    const referencePrint = (id: string): ReferencePrintReadModel => ({
      id,
      path: `media/investigation-case/case-9/reference-prints/${id}.png`,
      caseId: 'case-9',
      subjectId: null,
      position: null,
      createdAt: versedAt,
      matchings: [],
      withdrawnAt: null,
      withdrawalMotive: null,
    });
    const reader = new InMemoryReferencePrintReader([
      referencePrint('ref-a'),
      referencePrint('ref-c'),
      referencePrint('ref-b'),
    ]);
    const handler = new ListReferencePrintsHandler(
      reader,
      new InMemoryImageStorageAdapter(),
    );

    const { data } = await handler.execute(
      new ListReferencePrintsQuery('case-9'),
    );

    expect(data.map((print) => print.id)).toEqual(['ref-a', 'ref-b', 'ref-c']);
  });
  it('ne liste que les empreintes retirées quand on les demande', async () => {
    const reader = new InMemoryReferencePrintReader([
      {
        id: 'ref-1',
        path: 'media/investigation-case/case-9/reference-prints/ref-1.png',
        caseId: 'case-9',
        subjectId: null,
        position: null,
        createdAt: new Date('2026-07-01T00:00:00.000Z'),
        matchings: [],
        withdrawnAt: null,
        withdrawalMotive: null,
      },
      {
        id: 'ref-2',
        path: 'media/investigation-case/case-9/reference-prints/ref-2.png',
        caseId: 'case-9',
        subjectId: 'subject-1',
        position: 'RIGHT_INDEX',
        createdAt: new Date('2026-07-02T00:00:00.000Z'),
        matchings: [],
        withdrawnAt: new Date('2026-08-12T09:00:00.000Z'),
        withdrawalMotive: 'WRONG_ATTRIBUTION',
      },
    ]);
    const handler = new ListReferencePrintsHandler(
      reader,
      new InMemoryImageStorageAdapter(),
    );

    const { data } = await handler.execute(
      new ListReferencePrintsQuery('case-9', true),
    );

    expect(data.map((print) => print.id)).toEqual(['ref-2']);
    expect(data[0].withdrawalMotive).toBe('WRONG_ATTRIBUTION');
    expect(data[0].url).toBeDefined();
  });
});
