import { InMemoryReferencePrintRepository } from '../../../infrastructure/persistence/in-memory-reference-print.repository';
import { InMemoryImageStorageAdapter } from '../../../infrastructure/storage/in-memory-image-storage.adapter';
import { InMemoryImageConverter } from '../../../infrastructure/conversion/in-memory-image-converter.adapter';
import { InvalidImageError } from '../../ports/image-converter.port';
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
    handler = new UploadReferencePrintHandler(
      repo,
      storage,
      idGenerator,
      new InMemoryImageConverter(),
    );
  });

  it('converts a TIFF to PNG for display, archives the original under the same id and persists the PNG path', async () => {
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
      path: 'media/investigation-case/case-9/reference-prints/ref-456.png',
      url: '/media/investigation-case/case-9/reference-prints/ref-456.png',
    });

    const saved = await repo.findById('ref-456');
    expect(saved?.path).toBe(
      'media/investigation-case/case-9/reference-prints/ref-456.png',
    );
    expect(saved?.caseId).toBe('case-9');

    expect(
      storage
        .getSaved('investigation-case/case-9/reference-prints/ref-456.png')
        ?.toString(),
    ).toBe('png:clean-print');
    expect(
      storage
        .getSaved('investigation-case/case-9/reference-prints/ref-456.tif')
        ?.toString(),
    ).toBe('clean-print');
  });

  it('stores a non-TIFF upload as-is, without archive', async () => {
    const result = await handler.execute(
      new UploadReferencePrintCommand(
        Buffer.from('clean-print'),
        'thumb.png',
        'image/png',
        'case-9',
      ),
    );

    expect(result.path).toBe(
      'media/investigation-case/case-9/reference-prints/ref-456.png',
    );
    expect(
      storage
        .getSaved('investigation-case/case-9/reference-prints/ref-456.png')
        ?.toString(),
    ).toBe('clean-print');
    expect(
      storage.getSaved(
        'investigation-case/case-9/reference-prints/ref-456.tif',
      ),
    ).toBeUndefined();
  });

  it('rejects an unreadable TIFF without storing or persisting anything', async () => {
    await expect(
      handler.execute(
        new UploadReferencePrintCommand(
          Buffer.from('invalid-image'),
          'broken.tif',
          'image/tiff',
          'case-9',
        ),
      ),
    ).rejects.toBeInstanceOf(InvalidImageError);

    expect(await repo.findById('ref-456')).toBeNull();
    expect(
      storage.getSaved(
        'investigation-case/case-9/reference-prints/ref-456.tif',
      ),
    ).toBeUndefined();
    expect(
      storage.getSaved(
        'investigation-case/case-9/reference-prints/ref-456.png',
      ),
    ).toBeUndefined();
  });
});
