import { InvalidConcordanceVideoError } from '../errors/invalid-concordance-video.error';
import { ConcordanceVideo } from './concordance-video';

const SHA256 = 'a'.repeat(64);

const props = {
  id: 'video-1',
  caseId: 'case-1',
  traceId: 'trace-1',
  referencePrintId: 'ref-1',
  path: 'media/investigation-case/case-1/concordance-videos/video-1.mp4',
  sha256: SHA256,
  createdAt: new Date('2026-09-05T10:00:00Z'),
};

describe('ConcordanceVideo', () => {
  it('scelle une vidéo qui porte ses deux pièces', () => {
    expect(ConcordanceVideo.seal(props).toPrimitives()).toEqual(props);
  });

  it('refuse un condensat qui n’est pas un SHA-256 hexadécimal minuscule', () => {
    expect(() =>
      ConcordanceVideo.seal({ ...props, sha256: 'A'.repeat(64) }),
    ).toThrow(InvalidConcordanceVideoError);
    expect(() => ConcordanceVideo.seal({ ...props, sha256: 'abc' })).toThrow(
      InvalidConcordanceVideoError,
    );
  });

  it('refuse un chemin vide', () => {
    expect(() => ConcordanceVideo.seal({ ...props, path: '  ' })).toThrow(
      InvalidConcordanceVideoError,
    );
  });

  it('refuse une vidéo amputée de l’une de ses deux pièces', () => {
    expect(() => ConcordanceVideo.seal({ ...props, traceId: '' })).toThrow(
      InvalidConcordanceVideoError,
    );
    expect(() =>
      ConcordanceVideo.seal({ ...props, referencePrintId: '' }),
    ).toThrow(InvalidConcordanceVideoError);
  });

  it('se reconstitue à l’identique depuis ses primitives', () => {
    const video = ConcordanceVideo.reconstitute(props);
    expect(video.traceId).toBe('trace-1');
    expect(video.referencePrintId).toBe('ref-1');
    expect(video.sha256).toBe(SHA256);
  });
});
