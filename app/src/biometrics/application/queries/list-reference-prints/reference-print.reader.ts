import { ReferencePrintReadModel } from './reference-print-read-model';

export interface ReferencePrintReader {
  findByCaseId(caseId: string): Promise<ReferencePrintReadModel[]>;
}

export const REFERENCE_PRINT_READER = 'ReferencePrintReader';
