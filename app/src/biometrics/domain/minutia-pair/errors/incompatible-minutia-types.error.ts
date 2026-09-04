import {
  MinutiaTypeEnum,
  minutiaTypeLabel,
} from '../../../../shared/domain/forensics/minutiae';

export class IncompatibleMinutiaTypesError extends Error {
  constructor(
    readonly traceType: MinutiaTypeEnum,
    readonly referenceType: MinutiaTypeEnum,
  ) {
    super(
      `Types de minuties incompatibles : ${minutiaTypeLabel(
        traceType,
      )} sur la trace, ${minutiaTypeLabel(
        referenceType,
      )} sur l’empreinte de référence`,
    );
  }
}
