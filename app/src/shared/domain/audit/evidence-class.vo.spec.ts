import { EvidenceClass, EvidenceClassEnum } from './evidence-class.vo';

describe('EvidenceClass', () => {
  it('builds the two classes of evidence', () => {
    expect(EvidenceClass.observed().getValue()).toBe(
      EvidenceClassEnum.OBSERVED,
    );
    expect(EvidenceClass.declared().getValue()).toBe(
      EvidenceClassEnum.DECLARED,
    );
  });

  it('parses a stored value', () => {
    expect(
      EvidenceClass.from('OBSERVED').equals(EvidenceClass.observed()),
    ).toBe(true);
  });

  it('rejects an unknown class', () => {
    expect(() => EvidenceClass.from('PROBABLE')).toThrow();
  });

  it('compares by value', () => {
    expect(EvidenceClass.observed().equals(EvidenceClass.declared())).toBe(
      false,
    );
  });
});
