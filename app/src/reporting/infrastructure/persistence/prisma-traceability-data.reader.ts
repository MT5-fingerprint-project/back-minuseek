import { Injectable } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { TenantConnectionService } from '../../../tenancy/infrastructure/persistence/tenant-connection.service';
import { AuditActorPrimitives } from '../../../shared/domain/audit/audit-actor.vo';
import type {
  AnchorData,
  AuditEventData,
  TraceabilityData,
  TraceabilityDataReader,
} from '../../application/ports/traceability-data.reader';

@Injectable()
export class PrismaTraceabilityDataReader implements TraceabilityDataReader {
  constructor(private readonly tenantConnection: TenantConnectionService) {}

  async readCaseEvents(caseId: string): Promise<AuditEventData[]> {
    const prisma = await this.tenantConnection.getCurrentClient();
    const events = await prisma.auditEvent.findMany({
      where: { caseId },
      orderBy: { seq: 'asc' },
    });
    return events.map((event) => ({
      seq: Number(event.seq),
      eventType: event.eventType,
      traceId: event.traceId,
      evidenceClass: event.evidenceClass,
      actorDisplayName: (event.actor as unknown as AuditActorPrimitives)
        .displayName,
      occurredAt: event.occurredAt,
      payload: event.payload as Record<string, unknown>,
      hash: event.hash,
      prevHash: event.prevHash,
    }));
  }

  async readAnchors(): Promise<AnchorData[]> {
    const prisma = await this.tenantConnection.getCurrentClient();
    const anchors = await prisma.auditAnchor.findMany({
      orderBy: [{ headSeq: 'asc' }, { id: 'asc' }],
    });
    return anchors.map((anchor) => ({
      headSeq: Number(anchor.headSeq),
      headHash: anchor.headHash,
      tsaUrl: anchor.tsaUrl,
      anchoredAt: anchor.anchoredAt,
      tsrSha256: createHash('sha256')
        .update(Buffer.from(anchor.tsaResponse))
        .digest('hex'),
    }));
  }

  async read(caseId: string): Promise<TraceabilityData> {
    const prisma = await this.tenantConnection.getCurrentClient();

    const [caseEvents, spine, anchors] = await Promise.all([
      this.readCaseEvents(caseId),
      prisma.auditEvent.findMany({
        orderBy: { seq: 'asc' },
        select: { seq: true, hash: true },
      }),
      this.readAnchors(),
    ]);

    return {
      caseEvents,
      hashSpine: spine.map((link) => ({
        seq: Number(link.seq),
        hash: link.hash,
      })),
      anchors,
    };
  }
}
