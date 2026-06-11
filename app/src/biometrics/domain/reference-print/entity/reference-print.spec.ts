import { ReferencePrint } from './reference-print';

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
      });

      expect(rp.id).toBe('r-1');
      expect(rp.caseId).toBe('case-1');
    });
  });

  describe('toPrimitives', () => {
    it('emits id, path and caseId', () => {
      const rp = ReferencePrint.create({
        id: 'r-1',
        path: 'p',
        caseId: 'c-1',
      });

      expect(rp.toPrimitives()).toEqual({
        id: 'r-1',
        path: 'p',
        caseId: 'c-1',
      });
    });
  });
});
