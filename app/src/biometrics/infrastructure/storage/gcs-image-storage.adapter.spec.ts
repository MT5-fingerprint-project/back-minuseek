const mockSave = jest.fn().mockResolvedValue(undefined);
const mockDelete = jest.fn().mockResolvedValue(undefined);
const mockGetSignedUrl = jest
  .fn()
  .mockResolvedValue(['https://signed.example/url']);
const mockFile = jest.fn(() => ({
  save: mockSave,
  delete: mockDelete,
  getSignedUrl: mockGetSignedUrl,
}));
const mockBucket = jest.fn(() => ({ file: mockFile }));

jest.mock('@google-cloud/storage', () => ({
  Storage: jest.fn(() => ({ bucket: mockBucket })),
}));

import { GcsImageStorageAdapter } from './gcs-image-storage.adapter';

describe('GcsImageStorageAdapter', () => {
  beforeEach(() => jest.clearAllMocks());

  it('save() uploads to media/<path> with the inferred content-type and returns the key', async () => {
    const adapter = new GcsImageStorageAdapter('minuseek-media-dev', 900);

    const key = await adapter.save(Buffer.from('x'), 'traces/abc.png');

    expect(mockBucket).toHaveBeenCalledWith('minuseek-media-dev');
    expect(mockFile).toHaveBeenCalledWith('media/traces/abc.png');
    expect(mockSave).toHaveBeenCalledWith(
      expect.any(Buffer),
      expect.objectContaining({ contentType: 'image/png', resumable: false }),
    );
    expect(key).toBe('media/traces/abc.png');
  });

  it('getUrl() signs a V4 read URL without re-prefixing media/', async () => {
    const adapter = new GcsImageStorageAdapter('minuseek-media-dev', 600);

    const url = await adapter.getUrl('media/reference-prints/def.png');

    expect(mockFile).toHaveBeenCalledWith('media/reference-prints/def.png');
    expect(mockFile).not.toHaveBeenCalledWith(
      expect.stringContaining('media/media'),
    );
    expect(mockGetSignedUrl).toHaveBeenCalledWith(
      expect.objectContaining({ version: 'v4', action: 'read' }),
    );
    expect(url).toBe('https://signed.example/url');
  });

  it('delete() ignores a missing object', async () => {
    const adapter = new GcsImageStorageAdapter('minuseek-media-dev', 900);

    await adapter.delete('media/traces/abc.png');

    expect(mockFile).toHaveBeenCalledWith('media/traces/abc.png');
    expect(mockDelete).toHaveBeenCalledWith({ ignoreNotFound: true });
  });

  it('getUrl() caches: two calls for the same key sign only once', async () => {
    const adapter = new GcsImageStorageAdapter('minuseek-media-dev', 900);

    const first = await adapter.getUrl('media/traces/abc.png');
    const second = await adapter.getUrl('media/traces/abc.png');

    expect(first).toBe(second);
    expect(mockGetSignedUrl).toHaveBeenCalledTimes(1);
  });

  it('getUrl() signs two distinct keys separately', async () => {
    const adapter = new GcsImageStorageAdapter('minuseek-media-dev', 900);

    await adapter.getUrl('media/traces/a.png');
    await adapter.getUrl('media/traces/b.png');

    expect(mockGetSignedUrl).toHaveBeenCalledTimes(2);
  });

  it('getUrl() re-signs when the cached URL nears expiry', async () => {
    const nowSpy = jest.spyOn(Date, 'now').mockReturnValue(1_000_000);
    const adapter = new GcsImageStorageAdapter('minuseek-media-dev', 900);

    await adapter.getUrl('media/traces/abc.png');
    // 30s remaining (< 60s margin) -> must re-sign
    nowSpy.mockReturnValue(1_000_000 + 900_000 - 30_000);
    await adapter.getUrl('media/traces/abc.png');

    expect(mockGetSignedUrl).toHaveBeenCalledTimes(2);
    nowSpy.mockRestore();
  });
});
