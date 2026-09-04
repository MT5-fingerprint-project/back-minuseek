import type { MinutiaTypeEnum } from '../../../../shared/domain/forensics/minutiae';

export const MINUTIA_PAIR_READER = 'MinutiaPairReader';

export interface MinutiaPairRow {
  id: string;
  createdAt: Date;
  traceMinutiaLayerId: string;
  referenceMinutiaLayerId: string;
  minutiaType: MinutiaTypeEnum;
}

export interface MinutiaPairReader {
  findByTraceAndReferencePrint(
    traceId: string,
    referencePrintId: string,
    authoredBy?: string | null,
  ): Promise<MinutiaPairRow[]>;
}
