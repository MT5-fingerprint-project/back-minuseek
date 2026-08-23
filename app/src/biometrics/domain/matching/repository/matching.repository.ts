import { AuditEventDraft } from '../../../../shared/domain/ports/audit-trail.port';
import { Matching } from '../entity/matching';

export interface MatchingWrite {
  matching: Matching;
  act: AuditEventDraft;
}

export interface MatchingRepository {
  upsertMany(writes: MatchingWrite[]): Promise<void>;
  findByTraceId(traceId: string): Promise<Matching[]>;
}

export const MATCHING_REPOSITORY = 'MatchingRepository';
