import { InMemoryAuditTrailAppender } from '../../../audit-trail/infrastructure/persistence/in-memory-audit-trail.appender';
import {
  AuditEventDraft,
  AuditLink,
  AuditTrailPort,
} from '../../../shared/domain/ports/audit-trail.port';
import { ExportedImage } from '../../domain/exported-image/entity/exported-image';
import { ExportedImageRepository } from '../../domain/exported-image/repository/exported-image.repository';

export class InMemoryExportedImageRepository implements ExportedImageRepository {
  readonly store = new Map<string, ExportedImage>();

  constructor(
    readonly auditTrail: AuditTrailPort = new InMemoryAuditTrailAppender(),
  ) {}

  seed(image: ExportedImage): void {
    this.store.set(image.id, image);
  }

  async save(image: ExportedImage, act: AuditEventDraft): Promise<AuditLink> {
    this.store.set(image.id, image);
    return this.auditTrail.append(act);
  }

  findBySourcePieceId(sourcePieceId: string): Promise<ExportedImage[]> {
    return Promise.resolve(
      [...this.store.values()]
        .filter((image) => image.sourcePieceId === sourcePieceId)
        // Imite le tri Prisma (`createdAt`, puis `id` en départage).
        .sort((a, b) => {
          const byCreatedAt = a.createdAt.getTime() - b.createdAt.getTime();
          return byCreatedAt !== 0 ? byCreatedAt : a.id.localeCompare(b.id);
        }),
    );
  }
}
