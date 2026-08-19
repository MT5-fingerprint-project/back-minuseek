import { ImageAlreadyStoredError } from '../../application/ports/image-already-stored.error';
import { InMemoryImageStorageAdapter } from './in-memory-image-storage.adapter';

describe('InMemoryImageStorageAdapter', () => {
  let storage: InMemoryImageStorageAdapter;

  beforeEach(() => {
    storage = new InMemoryImageStorageAdapter();
  });

  it('stores a buffer under the media/ prefix', async () => {
    const key = await storage.save(Buffer.from('x'), 'traces/abc.png');

    expect(key).toBe('media/traces/abc.png');
    expect(storage.getSaved('traces/abc.png')?.toString()).toBe('x');
  });

  it('refuses to overwrite an existing key, like the GCS precondition does', async () => {
    await storage.save(Buffer.from('original'), 'traces/abc.png');

    await expect(
      storage.save(Buffer.from('tampered'), 'traces/abc.png'),
    ).rejects.toBeInstanceOf(ImageAlreadyStoredError);
    expect(storage.getSaved('traces/abc.png')?.toString()).toBe('original');
  });

  it('frees the key once the object is deleted', async () => {
    await storage.save(Buffer.from('original'), 'traces/abc.png');
    await storage.delete('media/traces/abc.png');

    await expect(
      storage.save(Buffer.from('second'), 'traces/abc.png'),
    ).resolves.toBe('media/traces/abc.png');
  });
});
