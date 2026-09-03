import { FileDigest } from '../../file-digest.vo';
import { TraceLocationPhoto } from './trace-location-photo';

const SEAL = FileDigest.ofBuffer(Buffer.from('location-photo'));

describe('TraceLocationPhoto', () => {
  const baseProps = {
    id: 'photo-1',
    traceId: 'trace-1',
    caseId: 'case-9',
    path: 'media/investigation-case/case-9/location-photos/photo-1.png',
    sha256: SEAL,
  };

  it('carries the seal taken on the deposited bytes', () => {
    expect(TraceLocationPhoto.attach(baseProps).sha256).toBe(SEAL.getValue());
  });

  it('rejects an empty id', () => {
    expect(() => TraceLocationPhoto.attach({ ...baseProps, id: '' })).toThrow(
      'TraceLocationPhoto id is required',
    );
  });

  it('rejects a photograph attached to no trace', () => {
    expect(() =>
      TraceLocationPhoto.attach({ ...baseProps, traceId: '' }),
    ).toThrow('TraceLocationPhoto traceId is required');
  });

  it('rejects a photograph outside any case', () => {
    expect(() =>
      TraceLocationPhoto.attach({ ...baseProps, caseId: '' }),
    ).toThrow('TraceLocationPhoto caseId is required');
  });

  it('rejects an empty storage path', () => {
    expect(() => TraceLocationPhoto.attach({ ...baseProps, path: '' })).toThrow(
      'TraceLocationPhoto path is required',
    );
  });

  it('emits every column the piece is written with', () => {
    expect(TraceLocationPhoto.attach(baseProps).toPrimitives()).toEqual({
      id: 'photo-1',
      traceId: 'trace-1',
      caseId: 'case-9',
      path: 'media/investigation-case/case-9/location-photos/photo-1.png',
      sha256: SEAL.getValue(),
      thumbPath: null,
    });
  });

  it('carries the display thumbnail stored alongside the photograph', () => {
    const THUMB =
      'media/investigation-case/case-9/location-photos/photo-1_thumb.webp';

    const photo = TraceLocationPhoto.attach({
      ...baseProps,
      thumbPath: THUMB,
    });

    expect(photo.thumbPath).toBe(THUMB);
    expect(photo.toPrimitives().thumbPath).toBe(THUMB);
  });

  it('carries no thumbnail when the deposit could not build one', () => {
    expect(TraceLocationPhoto.attach(baseProps).thumbPath).toBeNull();
  });

  it('survives a round-trip through the persisted primitives', () => {
    const primitives = TraceLocationPhoto.attach(baseProps).toPrimitives();

    expect(TraceLocationPhoto.reconstitute(primitives).toPrimitives()).toEqual(
      primitives,
    );
  });

  it('refuses a stored seal that is not a SHA-256', () => {
    expect(() =>
      TraceLocationPhoto.reconstitute({
        ...TraceLocationPhoto.attach(baseProps).toPrimitives(),
        sha256: 'pas-une-empreinte',
      }),
    ).toThrow();
  });
});
