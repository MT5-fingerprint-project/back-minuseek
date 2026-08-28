import { ReferencePrintReadModel } from './reference-print-read-model';

export interface ReferencePrintReader {
  findByCaseId(
    caseId: string,
    withdrawn: boolean,
  ): Promise<ReferencePrintReadModel[]>;
}

export const REFERENCE_PRINT_READER = 'ReferencePrintReader';
