import {
  AuditEventDraft,
  AuditLink,
} from '../../../../shared/domain/ports/audit-trail.port';
import { ReferencePrint } from '../entity/reference-print';

export interface ReferencePrintRepository {
  save(rp: ReferencePrint, act: AuditEventDraft): Promise<AuditLink>;
  findById(id: string): Promise<ReferencePrint | null>;
}

export const REFERENCE_PRINT_REPOSITORY = 'ReferencePrintRepository';
