import { ReferencePrint } from '../entity/reference-print';

export interface ReferencePrintRepository {
  save(rp: ReferencePrint): Promise<void>;
  findById(id: string): Promise<ReferencePrint | null>;
}

export const REFERENCE_PRINT_REPOSITORY = 'ReferencePrintRepository';
