import type { ReferencePrint } from '../../domain/reference-print/entity/reference-print';

export interface FamiliarReferencePrintReader {
  findDestroyableByCaseId(caseId: string): Promise<ReferencePrint[]>;
}

export const FAMILIAR_REFERENCE_PRINT_READER = 'FamiliarReferencePrintReader';
