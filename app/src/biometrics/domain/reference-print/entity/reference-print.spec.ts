import { ReferencePrint } from './reference-print';
import { FingerPosition } from '../value-objects/finger-position.vo';

describe('ReferencePrint', () => {
  describe('create', () => {
    it('builds a reference print with id, path and caseId', () => {
      const rp = ReferencePrint.create({
        id: 'r-1',
        path: 'media/case-1/referencePrints/r-1.png',
        caseId: 'case-1',
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
        subjectId: 'subject-1',
        position: FingerPosition.from('RIGHT_THUMB'),
      });

      expect(rp.subjectId).toBe('subject-1');
      expect(rp.position?.getValue()).toBe('RIGHT_THUMB');
    });

    it('rejects an empty id', () => {
      expect(() =>
        ReferencePrint.create({ id: '', path: 'p', caseId: 'c-1' }),
      ).toThrow();
    });

    it('rejects an empty path', () => {
      expect(() =>
        ReferencePrint.create({ id: 'r-1', path: '', caseId: 'c-1' }),
      ).toThrow();
    });

    it('rejects an empty caseId', () => {
      expect(() =>
        ReferencePrint.create({ id: 'r-1', path: 'p', caseId: '' }),
      ).toThrow();
    });
  });

  describe('reconstitute', () => {
    it('rebuilds a reference print from primitives', () => {
      const rp = ReferencePrint.reconstitute({
        id: 'r-1',
        path: 'media/case-1/referencePrints/r-1.png',
        caseId: 'case-1',
        subjectId: 'subject-1',
        position: 'LEFT_PALM',
      });

      expect(rp.id).toBe('r-1');
      expect(rp.caseId).toBe('case-1');
      expect(rp.subjectId).toBe('subject-1');
      expect(rp.position?.getValue()).toBe('LEFT_PALM');
    });
  });

  describe('toPrimitives', () => {
    it('emits id, path, caseId, subjectId and position', () => {
      const rp = ReferencePrint.create({
        id: 'r-1',
        path: 'p',
        caseId: 'c-1',
      });

      expect(rp.toPrimitives()).toEqual({
        id: 'r-1',
        path: 'p',
        caseId: 'c-1',
        subjectId: null,
        position: null,
      });
    });
  });
});
