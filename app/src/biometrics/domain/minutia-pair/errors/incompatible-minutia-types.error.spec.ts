import { MinutiaTypeEnum } from '../../../../shared/domain/forensics/minutiae';
import { IncompatibleMinutiaTypesError } from './incompatible-minutia-types.error';

describe('IncompatibleMinutiaTypesError', () => {
  it('names both sides in French so the operator knows what disagrees', () => {
    expect(
      new IncompatibleMinutiaTypesError(
        MinutiaTypeEnum.RIDGE_ENDING,
        MinutiaTypeEnum.BIFURCATION,
      ).message,
    ).toBe(
      'Types de minuties incompatibles : arrêt de ligne sur la trace, bifurcation sur l’empreinte de référence',
    );
  });
});
