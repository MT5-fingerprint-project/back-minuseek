import type { MinutiaTypeEnum } from '../../../../shared/domain/forensics/minutiae';

export interface MinutiaPairReadModel {
  id: string;
  number: number;
  traceMinutiaLayerId: string;
  referenceMinutiaLayerId: string;
  minutiaType: MinutiaTypeEnum;
}
