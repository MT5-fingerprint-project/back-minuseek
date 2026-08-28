import { AuditEventDraft } from '../../../../shared/domain/ports/audit-trail.port';
import type { Hit } from '../entity/hit';

export const HIT_REPOSITORY = Symbol('HIT_REPOSITORY');

export interface HitRepository {
  save(hit: Hit, act: AuditEventDraft): Promise<void>;
  withdrawByPair(
    traceId: string,
    referencePrintId: string,
    withdrawnAt: Date,
    act: AuditEventDraft,
  ): Promise<void>;
  findByTraceId(traceId: string): Promise<Hit[]>;
}
