import { InMemoryAuditTrailAppender } from '../../../audit-trail/infrastructure/persistence/in-memory-audit-trail.appender';
import {
  AuditEventDraft,
  AuditLink,
  AuditTrailPort,
} from '../../../shared/domain/ports/audit-trail.port';
import { ConcordanceVideo } from '../../domain/concordance-video/entity/concordance-video';
import { ConcordanceVideoRepository } from '../../domain/concordance-video/repository/concordance-video.repository';

export class InMemoryConcordanceVideoRepository implements ConcordanceVideoRepository {
  readonly store = new Map<string, ConcordanceVideo>();

  constructor(
    readonly auditTrail: AuditTrailPort = new InMemoryAuditTrailAppender(),
  ) {}

  seed(video: ConcordanceVideo): void {
    this.store.set(video.id, video);
  }

  async save(
    video: ConcordanceVideo,
    act: AuditEventDraft,
  ): Promise<AuditLink> {
    this.store.set(video.id, video);
    return this.auditTrail.append(act);
  }

  findByPair(
    traceId: string,
    referencePrintId: string,
  ): Promise<ConcordanceVideo[]> {
    return Promise.resolve(
      [...this.store.values()]
        .filter(
          (video) =>
            video.traceId === traceId &&
            video.referencePrintId === referencePrintId,
        )
        // Imite le tri Prisma (`createdAt`, puis `id` en départage).
        .sort((a, b) => {
          const byCreatedAt = a.createdAt.getTime() - b.createdAt.getTime();
          return byCreatedAt !== 0 ? byCreatedAt : a.id.localeCompare(b.id);
        }),
    );
  }
}
