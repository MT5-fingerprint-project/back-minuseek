import { InMemoryReferencePrintRepository } from '../../../infrastructure/persistence/in-memory-reference-print.repository';
import { InMemoryImageStorageAdapter } from '../../../infrastructure/storage/in-memory-image-storage.adapter';
import { IdGenerator } from '../../../../shared/domain/ports/id-generator';
import { UploadReferencePrintCommand } from './upload-reference-print.command';
import { UploadReferencePrintHandler } from './upload-reference-print.handler';

describe('UploadReferencePrintHandler', () => {
  let handler: UploadReferencePrintHandler;
  let repo: InMemoryReferencePrintRepository;
  let storage: InMemoryImageStorageAdapter;
  let idGenerator: IdGenerator;

  beforeEach(() => {
    repo = new InMemoryReferencePrintRepository();
    storage = new InMemoryImageStorageAdapter();
    idGenerator = { generate: jest.fn().mockReturnValue('ref-456') };
    handler = new UploadReferencePrintHandler(repo, storage, idGenerator);
  });

  it('stocke le fichier sous media/{caseId}/referencePrints, persiste la référence et retourne id + path', async () => {
    const result = await handler.execute(
      new UploadReferencePrintCommand(
        Buffer.from('clean-print'),
        'thumb.tiff',
        'image/tiff',
        'case-9',
      ),
    );

    expect(result).toEqual({
      id: 'ref-456',
      path: 'media/investigation-case/case-9/referencePrint/ref-456.tiff',
    });

    const saved = await repo.findById('ref-456');
    expect(saved?.path).toBe('media/investigation-case/case-9/referencePrint/ref-456.tiff');
    expect(saved?.caseId).toBe('case-9');

    expect(
      storage
        .getSaved('investigation-case/case-9/referencePrint/ref-456.tiff')
        ?.toString(),
    ).toBe('clean-print');
  });
});
