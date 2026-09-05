import {
  AuditEventDraft,
  AuditLink,
} from '../../../../shared/domain/ports/audit-trail.port';
import { ConcordanceVideo } from '../entity/concordance-video';

export interface ConcordanceVideoRepository {
  save(video: ConcordanceVideo, act: AuditEventDraft): Promise<AuditLink>;
  findByPair(
    traceId: string,
    referencePrintId: string,
  ): Promise<ConcordanceVideo[]>;
}

export const CONCORDANCE_VIDEO_REPOSITORY = 'ConcordanceVideoRepository';
