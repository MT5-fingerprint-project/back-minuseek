import { createHash } from 'node:crypto';
import { InMemoryImageConverter } from '../../infrastructure/conversion/in-memory-image-converter.adapter';
import { InMemoryImageStorageAdapter } from '../../infrastructure/storage/in-memory-image-storage.adapter';
import { storeDisplayableImage } from './displayable-image';

const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47]);
const JPG_MAGIC = Buffer.from([0xff, 0xd8, 0xff]);
const TIFF_MAGIC = Buffer.from([0x49, 0x49, 0x2a, 0x00]);

function digestOf(bytes: Buffer): string {
  return createHash('sha256').update(bytes).digest('hex');
}

function store(fileBuffer: Buffer) {
  return storeDisplayableImage(
    new InMemoryImageStorageAdapter(),
    new InMemoryImageConverter(),
    fileBuffer,
    'investigation-case/case-9/traces/trace-1',
  );
}

describe('storeDisplayableImage — sans conversion', () => {
  it.each([
    ['PNG', PNG_MAGIC, '.png'],
    ['JPEG', JPG_MAGIC, '.jpg'],
  ])(
    'sert le fichier %s reçu, sous son extension',
    async (_format, magic, extension) => {
      const bytes = Buffer.concat([magic, Buffer.from('image')]);

      const stored = await store(bytes);

      expect(stored.path).toBe(
        `media/investigation-case/case-9/traces/trace-1${extension}`,
      );
    },
  );

  it('porte la même empreinte dans les deux colonnes', async () => {
    const bytes = Buffer.concat([PNG_MAGIC, Buffer.from('image')]);

    const stored = await store(bytes);

    expect(stored.receivedSha256).toBe(digestOf(bytes));
    expect(stored.displayableSha256).toBe(stored.receivedSha256);
  });
});

describe('storeDisplayableImage — conversion d’un TIFF', () => {
  const tiff = Buffer.concat([TIFF_MAGIC, Buffer.from('trace')]);

  it('sert le PNG converti et archive l’original', async () => {
    const storage = new InMemoryImageStorageAdapter();

    const stored = await storeDisplayableImage(
      storage,
      new InMemoryImageConverter(),
      tiff,
      'investigation-case/case-9/traces/trace-1',
    );

    expect(stored.path).toBe(
      'media/investigation-case/case-9/traces/trace-1.png',
    );
    expect(
      storage.getSaved('investigation-case/case-9/traces/trace-1_original.tif'),
    ).toBeDefined();
  });

  it('porte deux empreintes différentes : le fichier reçu et le fichier servi', async () => {
    const stored = await store(tiff);

    expect(stored.receivedSha256).toBe(digestOf(tiff));
    expect(stored.displayableSha256).not.toBe(stored.receivedSha256);
  });

  it('empreinte le PNG servi, pas le TIFF archivé', async () => {
    const stored = await store(tiff);

    expect(stored.displayableSha256).toBe(
      digestOf(Buffer.concat([Buffer.from('png:'), tiff])),
    );
  });

  it('rend deux fois la même empreinte pour le même TIFF', async () => {
    const [first, second] = await Promise.all([store(tiff), store(tiff)]);

    expect(first.displayableSha256).toBe(second.displayableSha256);
  });
});
