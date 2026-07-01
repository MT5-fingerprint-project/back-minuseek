import { InMemoryImageStorageAdapter } from './in-memory-image-storage.adapter';
import { LocalImageStorageAdapter } from './local-image-storage.adapter';

describe('ImageStoragePort.getUrl — contract', () => {
  it('LocalImageStorageAdapter exposes the key without re-prefixing', async () => {
    const url = await new LocalImageStorageAdapter().getUrl(
      'media/traces/abc.png',
    );
    expect(url).toBe('/media/traces/abc.png');
    expect(url).not.toContain('media/media');
  });

  it('InMemoryImageStorageAdapter exposes the key without re-prefixing', async () => {
    const url = await new InMemoryImageStorageAdapter().getUrl(
      'media/reference-prints/def.png',
    );
    expect(url).toBe('/media/reference-prints/def.png');
    expect(url).not.toContain('media/media');
  });

  it('does not double the leading slash', async () => {
    const url = await new LocalImageStorageAdapter().getUrl('/media/z.png');
    expect(url).toBe('/media/z.png');
  });

  it('round-trip save -> getUrl keeps a single media/ prefix', async () => {
    const storage = new InMemoryImageStorageAdapter();
    const key = await storage.save(Buffer.from('x'), 'traces/rt.png');
    expect(key).toBe('media/traces/rt.png');
    const url = await storage.getUrl(key);
    expect(url).toBe('/media/traces/rt.png');
    expect(url).not.toContain('media/media');
  });
});
