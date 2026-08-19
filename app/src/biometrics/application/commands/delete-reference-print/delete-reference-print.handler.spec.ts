import { ReferencePrint } from '../../../domain/reference-print/entity/reference-print';
import { ReferencePrintNotFoundError } from '../../../domain/reference-print/errors/reference-print-not-found.error';
import { InMemoryReferencePrintRepository } from '../../../infrastructure/persistence/in-memory-reference-print.repository';
import { InMemoryImageStorageAdapter } from '../../../infrastructure/storage/in-memory-image-storage.adapter';
import { DeleteReferencePrintCommand } from './delete-reference-print.command';
import { DeleteReferencePrintHandler } from './delete-reference-print.handler';

describe('DeleteReferencePrintHandler', () => {
  let handler: DeleteReferencePrintHandler;
  let repo: InMemoryReferencePrintRepository;
  let storage: InMemoryImageStorageAdapter;

  beforeEach(() => {
    repo = new InMemoryReferencePrintRepository();
    storage = new InMemoryImageStorageAdapter();
    handler = new DeleteReferencePrintHandler(repo, storage);
  });

  it('deletes the reference print, its PNG and the archived TIFF original', async () => {
    await storage.save(
      Buffer.from('png'),
      'investigation-case/case-1/reference-prints/ref-1.png',
    );
    await storage.save(
      Buffer.from('tif'),
      'investigation-case/case-1/reference-prints/ref-1_original.tif',
    );
    await repo.save(
      ReferencePrint.create({
        id: 'ref-1',
        path: 'media/investigation-case/case-1/reference-prints/ref-1.png',
        caseId: 'case-1',
        subjectId: null,
        position: null,
      }),
    );

    await handler.execute(new DeleteReferencePrintCommand('ref-1'));

    expect(await repo.findById('ref-1')).toBeNull();
    expect(
      storage.getSaved('investigation-case/case-1/reference-prints/ref-1.png'),
    ).toBeUndefined();
    expect(
      storage.getSaved(
        'investigation-case/case-1/reference-prints/ref-1_original.tif',
      ),
    ).toBeUndefined();
  });

  it('rejects when the reference print does not exist', async () => {
    await expect(
      handler.execute(new DeleteReferencePrintCommand('missing')),
    ).rejects.toBeInstanceOf(ReferencePrintNotFoundError);
  });
});
