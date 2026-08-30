import { InMemoryFingerprintLocatorAdapter } from '../../../infrastructure/persistence/in-memory-fingerprint-locator.adapter';
import { InMemoryExportedImageReader } from '../../../infrastructure/persistence/in-memory-exported-image.reader';
import { InMemoryImageStorageAdapter } from '../../../infrastructure/storage/in-memory-image-storage.adapter';
import { ListExportedImagesHandler } from './list-exported-images.handler';
import { ListExportedImagesQuery } from './list-exported-images.query';

describe('ListExportedImagesHandler', () => {
  let locator: InMemoryFingerprintLocatorAdapter;
  let reader: InMemoryExportedImageReader;
  let storage: InMemoryImageStorageAdapter;
  let handler: ListExportedImagesHandler;

  beforeEach(() => {
    locator = new InMemoryFingerprintLocatorAdapter();
    reader = new InMemoryExportedImageReader();
    storage = new InMemoryImageStorageAdapter();
    handler = new ListExportedImagesHandler(locator, reader, storage);
  });

  it("liste les exports d'une pièce, avec une adresse signée", async () => {
    locator.setTrace('trace-1', 'case-1');
    reader.seed({
      id: 'export-1',
      sourcePieceId: 'trace-1',
      sourceKind: 'TRACE',
      path: 'media/investigation-case/case-1/exports/export-1.png',
      sha256: 'a'.repeat(64),
      createdAt: new Date('2026-08-30T09:00:00.000Z'),
    });

    const { data } = await handler.execute(
      new ListExportedImagesQuery('case-1', 'trace-1'),
    );

    expect(data).toEqual([
      {
        id: 'export-1',
        sourcePieceId: 'trace-1',
        sourceKind: 'TRACE',
        sha256: 'a'.repeat(64),
        createdAt: new Date('2026-08-30T09:00:00.000Z'),
        url: '/media/investigation-case/case-1/exports/export-1.png',
      },
    ]);
  });

  it('départage par identifiant deux exports au même horodatage', async () => {
    locator.setTrace('trace-1', 'case-1');
    const sameInstant = new Date('2026-08-30T09:00:00.000Z');
    reader.seed({
      id: 'export-2',
      sourcePieceId: 'trace-1',
      sourceKind: 'TRACE',
      path: 'media/investigation-case/case-1/exports/export-2.png',
      sha256: 'b'.repeat(64),
      createdAt: sameInstant,
    });
    reader.seed({
      id: 'export-1',
      sourcePieceId: 'trace-1',
      sourceKind: 'TRACE',
      path: 'media/investigation-case/case-1/exports/export-1.png',
      sha256: 'a'.repeat(64),
      createdAt: sameInstant,
    });

    const { data } = await handler.execute(
      new ListExportedImagesQuery('case-1', 'trace-1'),
    );

    expect(data.map((view) => view.id)).toEqual(['export-1', 'export-2']);
  });

  it('rend une liste vide quand la pièce est introuvable', async () => {
    const { data } = await handler.execute(
      new ListExportedImagesQuery('case-1', 'unknown'),
    );

    expect(data).toEqual([]);
  });

  it('rend une liste vide quand la pièce appartient à un autre dossier (IDOR)', async () => {
    locator.setTrace('trace-1', 'other-case');
    reader.seed({
      id: 'export-1',
      sourcePieceId: 'trace-1',
      sourceKind: 'TRACE',
      path: 'media/investigation-case/other-case/exports/export-1.png',
      sha256: 'a'.repeat(64),
      createdAt: new Date(),
    });

    const { data } = await handler.execute(
      new ListExportedImagesQuery('case-1', 'trace-1'),
    );

    expect(data).toEqual([]);
  });

  it("rend une liste vide quand la pièce n'a encore aucun export", async () => {
    locator.setReferencePrint('ref-1', 'case-1');

    const { data } = await handler.execute(
      new ListExportedImagesQuery('case-1', 'ref-1'),
    );

    expect(data).toEqual([]);
  });
});
