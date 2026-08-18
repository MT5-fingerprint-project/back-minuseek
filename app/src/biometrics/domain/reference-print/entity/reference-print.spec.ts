import { ReferencePrint } from './reference-print';
import { FileDigest, InvalidFileDigestError } from '../../file-digest.vo';
import { FingerPosition } from '../value-objects/finger-position.vo';

const CLEAN_PRINT_SHA256 =
  '70ccc2a604c5f59ed11bdd4b2eb82763359189b62487cb0326c1a05b07769665';

describe('ReferencePrint', () => {
  const seal = () => FileDigest.ofBuffer(Buffer.from('clean-print'));

  describe('create', () => {
    it('builds a reference print with id, path and caseId', () => {
      const rp = ReferencePrint.create({
        id: 'r-1',
        path: 'media/case-1/referencePrints/r-1.png',
        caseId: 'case-1',
        sha256: seal(),
      });

      expect(rp.id).toBe('r-1');
      expect(rp.path).toBe('media/case-1/referencePrints/r-1.png');
      expect(rp.caseId).toBe('case-1');
      expect(rp.subjectId).toBeNull();
      expect(rp.position).toBeNull();
    });

    it('carries an optional subjectId and finger position', () => {
      const rp = ReferencePrint.create({
        id: 'r-1',
        path: 'p',
        caseId: 'case-1',
        sha256: seal(),
        subjectId: 'subject-1',
        position: FingerPosition.from('RIGHT_THUMB'),
      });

      expect(rp.subjectId).toBe('subject-1');
      expect(rp.position?.getValue()).toBe('RIGHT_THUMB');
    });

    it('carries the seal taken on the deposited bytes', () => {
      const rp = ReferencePrint.create({
        id: 'r-1',
        path: 'p',
        caseId: 'c-1',
        sha256: seal(),
      });

      expect(rp.sha256).toBe(CLEAN_PRINT_SHA256);
    });

    it('rejects an empty id', () => {
      expect(() =>
        ReferencePrint.create({
          id: '',
          path: 'p',
          caseId: 'c-1',
          sha256: seal(),
        }),
      ).toThrow();
    });

    it('rejects an empty path', () => {
      expect(() =>
        ReferencePrint.create({
          id: 'r-1',
          path: '',
          caseId: 'c-1',
          sha256: seal(),
        }),
      ).toThrow();
    });

    it('rejects an empty caseId', () => {
      expect(() =>
        ReferencePrint.create({
          id: 'r-1',
          path: 'p',
          caseId: '',
          sha256: seal(),
        }),
      ).toThrow();
    });
  });

  describe('reconstitute', () => {
    it('rebuilds a reference print from primitives', () => {
      const rp = ReferencePrint.reconstitute({
        id: 'r-1',
        path: 'media/case-1/referencePrints/r-1.png',
        caseId: 'case-1',
        sha256: CLEAN_PRINT_SHA256,
        subjectId: 'subject-1',
        position: 'LEFT_PALM',
      });

      expect(rp.id).toBe('r-1');
      expect(rp.caseId).toBe('case-1');
      expect(rp.sha256).toBe(CLEAN_PRINT_SHA256);
      expect(rp.subjectId).toBe('subject-1');
      expect(rp.position?.getValue()).toBe('LEFT_PALM');
    });

    it('rebuilds a reference print deposited before the seal existed', () => {
      const rp = ReferencePrint.reconstitute({
        id: 'r-1',
        path: 'p',
        caseId: 'case-1',
        sha256: null,
        subjectId: null,
        position: null,
      });

      expect(rp.sha256).toBeNull();
    });

    it('refuses a stored seal that is not a SHA-256', () => {
      expect(() =>
        ReferencePrint.reconstitute({
          id: 'r-1',
          path: 'p',
          caseId: 'case-1',
          sha256: 'not-a-hash',
          subjectId: null,
          position: null,
        }),
      ).toThrow(InvalidFileDigestError);
    });
  });

  describe('toPrimitives', () => {
    it('emits id, path, caseId, seal, subjectId and position', () => {
      const rp = ReferencePrint.create({
        id: 'r-1',
        path: 'p',
        caseId: 'c-1',
        sha256: seal(),
      });

      expect(rp.toPrimitives()).toEqual({
        id: 'r-1',
        path: 'p',
        caseId: 'c-1',
        sha256: CLEAN_PRINT_SHA256,
        subjectId: null,
        position: null,
      });
    });
  });
});
