import { InMemoryImageStorageAdapter } from '../../../infrastructure/storage/in-memory-image-storage.adapter';
import { ListReferencePrintsHandler } from './list-reference-prints.handler';
import { ListReferencePrintsQuery } from './list-reference-prints.query';
import { ReferencePrintReadModel } from './reference-print-read-model';
import { ReferencePrintReader } from './reference-print.reader';

class InMemoryReferencePrintReader implements ReferencePrintReader {
  constructor(private readonly referencePrints: ReferencePrintReadModel[]) {}

  findByCaseId(caseId: string): Promise<ReferencePrintReadModel[]> {
    return Promise.resolve(
      this.referencePrints.filter(
        (referencePrint) => referencePrint.caseId === caseId,
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
        createdAt: new Date('2026-07-01T00:00:00.000Z'),
        matchings: [],
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
});
