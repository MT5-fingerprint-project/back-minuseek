import {
  InvalidRevelationTechniqueError,
  RevelationTechnique,
  RevelationTechniqueEnum,
} from './revelation-technique.vo';

describe('RevelationTechnique', () => {
  it('accepts each of the four techniques of the closed vocabulary', () => {
    expect(RevelationTechnique.from('OPTICAL_PROCESS').getValue()).toBe(
      RevelationTechniqueEnum.OPTICAL_PROCESS,
    );
    expect(RevelationTechnique.from('FINGERPRINT_POWDER').getValue()).toBe(
      RevelationTechniqueEnum.FINGERPRINT_POWDER,
    );
    expect(RevelationTechnique.from('DFO').getValue()).toBe(
      RevelationTechniqueEnum.DFO,
    );
    expect(RevelationTechnique.from('NINHYDRIN').getValue()).toBe(
      RevelationTechniqueEnum.NINHYDRIN,
    );
  });

  it('rejects a technique outside the vocabulary', () => {
    expect(() => RevelationTechnique.from('CYANOACRYLATE')).toThrow(
      InvalidRevelationTechniqueError,
    );
  });

  it('reads an absent technique from persistence as no technique at all', () => {
    expect(RevelationTechnique.fromPersistence(null)).toBeNull();
    expect(RevelationTechnique.fromPersistence('DFO')?.getValue()).toBe(
      RevelationTechniqueEnum.DFO,
    );
  });

  it('compares by value', () => {
    expect(
      RevelationTechnique.from('DFO').equals(RevelationTechnique.from('DFO')),
    ).toBe(true);
    expect(
      RevelationTechnique.from('DFO').equals(
        RevelationTechnique.from('NINHYDRIN'),
      ),
    ).toBe(false);
  });
});
