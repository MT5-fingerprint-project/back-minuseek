import { AuditEventDraft } from '../../../../shared/domain/ports/audit-trail.port';
import { ReferencePrint } from '../entity/reference-print';

export interface ReferencePrintRepository {
  save(rp: ReferencePrint, act: AuditEventDraft): Promise<void>;
  findById(id: string): Promise<ReferencePrint | null>;
  delete(id: string, act: AuditEventDraft): Promise<void>;
}

export const REFERENCE_PRINT_REPOSITORY = 'ReferencePrintRepository';
