import { createHash } from 'node:crypto';
import type { ReportStoragePort } from '../../application/ports/report-storage.port';
import { StorageReportImageEmbedder } from './storage-report-image.embedder';

const PNG_1x1 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

function storage(bytes: Buffer | Error): ReportStoragePort {
  return {
    save: () => Promise.resolve(''),
    getUrl: () => Promise.resolve(''),
    read: () =>
      bytes instanceof Error ? Promise.reject(bytes) : Promise.resolve(bytes),
  };
}

describe('StorageReportImageEmbedder', () => {
  it('rend l’empreinte des octets qu’il vient de lire', async () => {
    const embedder = new StorageReportImageEmbedder(storage(PNG_1x1));

    const image = await embedder.embed('media/case-1/traces/trace-1.png');

    expect(image?.observedSha256).toBe(
      createHash('sha256').update(PNG_1x1).digest('hex'),
    );
  });

  it('lit aussi les dimensions natives, qui replacent les minuties', async () => {
    const embedder = new StorageReportImageEmbedder(storage(PNG_1x1));

    const image = await embedder.embed('media/case-1/traces/trace-1.png');

    expect(image).toMatchObject({ width: 1, height: 1 });
    expect(image?.dataUrl.startsWith('data:image/png;base64,')).toBe(true);
  });

  it('rend null sans jeter quand la pièce est illisible', async () => {
    const embedder = new StorageReportImageEmbedder(
      storage(new Error('stockage injoignable')),
    );

    await expect(
      embedder.embed('media/case-1/traces/trace-1.png'),
    ).resolves.toBeNull();
  });

  it('rend l’empreinte même quand les dimensions natives sont illisibles', async () => {
    const bytes = Buffer.from('pas une image');
    const embedder = new StorageReportImageEmbedder(storage(bytes));

    const image = await embedder.embed('media/case-1/traces/trace-1.tif');

    expect(image?.width).toBeNull();
    expect(image?.observedSha256).toBe(
      createHash('sha256').update(bytes).digest('hex'),
    );
  });
});
