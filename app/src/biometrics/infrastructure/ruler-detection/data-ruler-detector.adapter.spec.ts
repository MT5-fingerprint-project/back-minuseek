import { BadGatewayException } from '@nestjs/common';
import { DataRulerDetectorAdapter } from './data-ruler-detector.adapter';

describe('DataRulerDetectorAdapter', () => {
  const baseUrl = 'http://data:8000';
  const image = Buffer.from('fake-jpeg-bytes');
  let adapter: DataRulerDetectorAdapter;
  let fetchMock: jest.Mock;

  const respond = (body: unknown, ok = true) =>
    fetchMock.mockResolvedValue({
      ok,
      json: () =>
        typeof body === 'string'
          ? Promise.reject(new SyntaxError(body))
          : Promise.resolve(body),
    });

  beforeEach(() => {
    adapter = new DataRulerDetectorAdapter(baseUrl);
    jest
      .spyOn(
        adapter as unknown as { authorizationHeader: () => Promise<string> },
        'authorizationHeader',
      )
      .mockResolvedValue('Bearer id-token');
    fetchMock = jest.fn();
    global.fetch = fetchMock;
  });

  it('posts the raw bytes as multipart to data with the service ID token', async () => {
    respond({ present: true, confidence: 0.82, engine_version: 'ruler-x' });

    await adapter.detect({ image, mimeType: 'image/jpeg' });

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('http://data:8000/data/api/detect-ruler');
    expect(init.method).toBe('POST');
    expect(init.headers).toEqual({ authorization: 'Bearer id-token' });
    const sent = (init.body as FormData).get('image') as Blob;
    expect(sent.type).toBe('image/jpeg');
    expect(Buffer.from(await sent.arrayBuffer()).equals(image)).toBe(true);
  });

  it('maps the verdict, its confidence and the engine version', async () => {
    respond({ present: false, confidence: 0.17, engine_version: 'ruler-x' });

    await expect(
      adapter.detect({ image, mimeType: 'image/png' }),
    ).resolves.toEqual({
      present: false,
      confidence: 0.17,
      engineVersion: 'ruler-x',
    });
  });

  it('reports a null engine version when data omits it', async () => {
    respond({ present: true, confidence: 0.5 });

    const detection = await adapter.detect({ image, mimeType: 'image/png' });

    expect(detection.engineVersion).toBeNull();
  });

  it.each([
    ['a non-2xx status', { present: true, confidence: 1 }, false],
    ['an unparsable body', 'not json', true],
    ['a body without verdict', { confidence: 0.3 }, true],
  ])('fails as bad gateway on %s', async (_label, body, ok) => {
    respond(body, ok);

    await expect(
      adapter.detect({ image, mimeType: 'image/png' }),
    ).rejects.toBeInstanceOf(BadGatewayException);
  });
});
