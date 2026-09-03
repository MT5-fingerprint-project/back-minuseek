import { createHash } from 'node:crypto';
import { InMemoryImageConverter } from '../../infrastructure/conversion/in-memory-image-converter.adapter';
import { InMemoryImageStorageAdapter } from '../../infrastructure/storage/in-memory-image-storage.adapter';
import { storeDisplayableImage, thumbnailPath } from './displayable-image';

const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47]);
const JPG_MAGIC = Buffer.from([0xff, 0xd8, 0xff]);
const TIFF_MAGIC = Buffer.from([0x49, 0x49, 0x2a, 0x00]);

function digestOf(bytes: Buffer): string {
  return createHash('sha256').update(bytes).digest('hex');
}

class RecordingLogger {
  readonly warnings: string[] = [];

  warn(message: string): void {
    this.warnings.push(message);
  }
}

function store(fileBuffer: Buffer, logger = new RecordingLogger()) {
  return storeDisplayableImage(
    new InMemoryImageStorageAdapter(),
    new InMemoryImageConverter(),
    fileBuffer,
    'investigation-case/case-9/traces/trace-1',
    logger,
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
      new RecordingLogger(),
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

describe('thumbnailPath', () => {
  it.each([
    ['un PNG', 'media/traces/trace-1.png'],
    ['un JPEG', 'media/traces/trace-1.jpg'],
    ['un TIFF', 'media/traces/trace-1.tif'],
  ])(
    'remplace l’extension par le suffixe de vignette (%s)',
    (_format, path) => {
      expect(thumbnailPath(path)).toBe('media/traces/trace-1_thumb.webp');
    },
  );

  it('pose le suffixe avant le point, jamais après', () => {
    // data-minuseek résout la pièce à comparer en listant le préfixe `{id}.` et
    // prend le premier blob : `{id}.thumb.webp` ferait comparer la vignette.
    expect(thumbnailPath('media/traces/trace-1.png')).not.toContain(
      'trace-1.thumb',
    );
  });

  it('ne touche pas à un point porté par un dossier', () => {
    expect(thumbnailPath('media/case.9/trace-1')).toBe(
      'media/case.9/trace-1_thumb.webp',
    );
  });
});

class ThumbnailHostileStorage extends InMemoryImageStorageAdapter {
  save(buffer: Buffer, relativePath: string): Promise<string> {
    if (relativePath.endsWith('_thumb.webp')) {
      return Promise.reject(new Error('stockage injoignable'));
    }
    return super.save(buffer, relativePath);
  }
}

describe('storeDisplayableImage — vignette d’affichage', () => {
  const png = Buffer.concat([PNG_MAGIC, Buffer.from('image')]);
  const tiff = Buffer.concat([TIFF_MAGIC, Buffer.from('trace')]);

  it('stocke la vignette à côté du fichier servi', async () => {
    const storage = new InMemoryImageStorageAdapter();

    const stored = await storeDisplayableImage(
      storage,
      new InMemoryImageConverter(),
      png,
      'investigation-case/case-9/traces/trace-1',
      new RecordingLogger(),
    );

    expect(stored.thumbPath).toBe(
      'media/investigation-case/case-9/traces/trace-1_thumb.webp',
    );
    expect(
      storage.getSaved('investigation-case/case-9/traces/trace-1_thumb.webp'),
    ).toEqual(Buffer.concat([Buffer.from('thumb:'), png]));
  });

  it('fabrique la vignette d’un TIFF depuis le PNG affichable, pas depuis le TIFF', async () => {
    const storage = new InMemoryImageStorageAdapter();

    const stored = await storeDisplayableImage(
      storage,
      new InMemoryImageConverter(),
      tiff,
      'investigation-case/case-9/traces/trace-1',
      new RecordingLogger(),
    );

    expect(stored.thumbPath).toBe(
      'media/investigation-case/case-9/traces/trace-1_thumb.webp',
    );
    expect(
      storage.getSaved('investigation-case/case-9/traces/trace-1_thumb.webp'),
    ).toEqual(
      Buffer.concat([Buffer.from('thumb:'), Buffer.from('png:'), tiff]),
    );
  });

  it('dépose la pièce quand même si la conversion de la vignette échoue', async () => {
    const storage = new InMemoryImageStorageAdapter();
    const undecodableThumbnail = Buffer.concat([
      PNG_MAGIC,
      Buffer.from('invalid'),
    ]);

    const stored = await storeDisplayableImage(
      storage,
      new InMemoryImageConverter(),
      undecodableThumbnail,
      'investigation-case/case-9/traces/trace-1',
      new RecordingLogger(),
    );

    expect(stored.thumbPath).toBeNull();
    expect(stored.path).toBe(
      'media/investigation-case/case-9/traces/trace-1.png',
    );
    expect(stored.receivedSha256).toBe(digestOf(undecodableThumbnail));
    expect(
      storage.getSaved('investigation-case/case-9/traces/trace-1.png'),
    ).toEqual(undecodableThumbnail);
  });

  it('dépose la pièce quand même si le stockage de la vignette échoue', async () => {
    const storage = new ThumbnailHostileStorage();

    const stored = await storeDisplayableImage(
      storage,
      new InMemoryImageConverter(),
      png,
      'investigation-case/case-9/traces/trace-1',
      new RecordingLogger(),
    );

    expect(stored.thumbPath).toBeNull();
    expect(
      storage.getSaved('investigation-case/case-9/traces/trace-1.png'),
    ).toEqual(png);
  });

  it('dépose un TIFF quand même si sa vignette échoue, PNG servi et original archivés', async () => {
    const storage = new ThumbnailHostileStorage();

    const stored = await storeDisplayableImage(
      storage,
      new InMemoryImageConverter(),
      tiff,
      'investigation-case/case-9/traces/trace-1',
      new RecordingLogger(),
    );

    expect(stored.thumbPath).toBeNull();
    expect(stored.displayableSha256).toBe(
      digestOf(Buffer.concat([Buffer.from('png:'), tiff])),
    );
    expect(
      storage.getSaved('investigation-case/case-9/traces/trace-1_original.tif'),
    ).toEqual(tiff);
  });
});

describe('storeDisplayableImage — journal de la vignette manquante', () => {
  const png = Buffer.concat([PNG_MAGIC, Buffer.from('image')]);
  const undecodable = Buffer.concat([PNG_MAGIC, Buffer.from('invalid')]);

  it('ne dit rien quand la vignette est stockée', async () => {
    const logger = new RecordingLogger();

    await store(png, logger);

    expect(logger.warnings).toEqual([]);
  });

  it('nomme la pièce et la cause quand le stockage refuse', async () => {
    const logger = new RecordingLogger();

    await storeDisplayableImage(
      new ThumbnailHostileStorage(),
      new InMemoryImageConverter(),
      png,
      'investigation-case/case-9/traces/trace-1',
      logger,
    );

    expect(logger.warnings).toEqual([
      "Vignette d'affichage non fabriquée pour la pièce investigation-case/case-9/traces/trace-1.png (Error: stockage injoignable) — « make backfill-thumbnails TENANT_DB=<base> » répare",
    ]);
  });

  it('nomme la pièce et la cause quand la conversion refuse', async () => {
    const logger = new RecordingLogger();

    await store(undecodable, logger);

    expect(logger.warnings).toEqual([
      "Vignette d'affichage non fabriquée pour la pièce investigation-case/case-9/traces/trace-1.png (Error: Image illisible : impossible de la décoder pour la conversion) — « make backfill-thumbnails TENANT_DB=<base> » répare",
    ]);
  });

  it('désigne le PNG servi quand c’est un TIFF qui a été déposé', async () => {
    const logger = new RecordingLogger();

    await storeDisplayableImage(
      new ThumbnailHostileStorage(),
      new InMemoryImageConverter(),
      Buffer.concat([TIFF_MAGIC, Buffer.from('trace')]),
      'investigation-case/case-9/traces/trace-1',
      logger,
    );

    expect(logger.warnings).toEqual([
      "Vignette d'affichage non fabriquée pour la pièce investigation-case/case-9/traces/trace-1.png (Error: stockage injoignable) — « make backfill-thumbnails TENANT_DB=<base> » répare",
    ]);
  });
});
