import { InMemoryReferencePrintRepository } from '../../../infrastructure/persistence/in-memory-reference-print.repository';
import { InMemoryImageStorageAdapter } from '../../../infrastructure/storage/in-memory-image-storage.adapter';
import { InMemoryImageConverter } from '../../../infrastructure/conversion/in-memory-image-converter.adapter';
import { InvalidImageError } from '../../ports/image-converter.port';
import { UnsupportedImageFormatError } from '../../services/displayable-image';
import { IdGenerator } from '../../../../shared/domain/ports/id-generator';
import { UploadReferencePrintCommand } from './upload-reference-print.command';
import { UploadReferencePrintHandler } from './upload-reference-print.handler';

const TIFF_MAGIC = Buffer.from([0x49, 0x49, 0x2a, 0x00]);
const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47]);

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

  it('converts a TIFF to PNG for display, archives the original under <id>_original.tif and persists the PNG path', async () => {
    const tiffBuffer = Buffer.concat([TIFF_MAGIC, Buffer.from('clean-print')]);
    const result = await handler.execute(
      new UploadReferencePrintCommand(tiffBuffer, 'case-9'),
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
        ?.equals(Buffer.concat([Buffer.from('png:'), tiffBuffer])),
    ).toBe(true);
    expect(
      storage
        .getSaved(
          'investigation-case/case-9/reference-prints/ref-456_original.tif',
        )
        ?.equals(tiffBuffer),
    ).toBe(true);
  });

  it('stores a non-TIFF upload as-is, without archive, even with a misleading name', async () => {
    const pngBuffer = Buffer.concat([PNG_MAGIC, Buffer.from('clean-print')]);
    const result = await handler.execute(
      new UploadReferencePrintCommand(pngBuffer, 'case-9'),
    );

    expect(result.path).toBe(
      'media/investigation-case/case-9/reference-prints/ref-456.png',
    );
    expect(
      storage
        .getSaved('investigation-case/case-9/reference-prints/ref-456.png')
        ?.equals(pngBuffer),
    ).toBe(true);
    expect(
      storage.getSaved(
        'investigation-case/case-9/reference-prints/ref-456_original.tif',
      ),
    ).toBeUndefined();
  });

  it('rejects an unreadable TIFF without storing or persisting anything', async () => {
    await expect(
      handler.execute(
        new UploadReferencePrintCommand(
          Buffer.concat([TIFF_MAGIC, Buffer.from('invalid-image')]),
          'case-9',
        ),
      ),
    ).rejects.toBeInstanceOf(InvalidImageError);

    expect(await repo.findById('ref-456')).toBeNull();
    expect(
      storage.getSaved(
        'investigation-case/case-9/reference-prints/ref-456_original.tif',
      ),
    ).toBeUndefined();
    expect(
      storage.getSaved(
        'investigation-case/case-9/reference-prints/ref-456.png',
      ),
    ).toBeUndefined();
  });

  it('rejects a payload that is neither PNG, JPEG nor TIFF without storing anything', async () => {
    await expect(
      handler.execute(
        new UploadReferencePrintCommand(Buffer.from('not-an-image'), 'case-9'),
      ),
    ).rejects.toBeInstanceOf(UnsupportedImageFormatError);

    expect(await repo.findById('ref-456')).toBeNull();
    expect(
      storage.getSaved(
        'investigation-case/case-9/reference-prints/ref-456.png',
      ),
    ).toBeUndefined();
  });
});
