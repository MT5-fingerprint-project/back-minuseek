import { Injectable } from '@nestjs/common';
import { TenantConnectionService } from '../../../tenancy/infrastructure/persistence/tenant-connection.service';
import {
  AnchorPoint,
  SEALING_EVENTS,
  SealingEvent,
} from '../../application/seals/seal-projection';

@Injectable()
export class PrismaSealSourceReader {
  constructor(private readonly tenantConnection: TenantConnectionService) {}

  async readSealingEvents(
    afterSeq: bigint,
    take: number,
  ): Promise<SealingEvent[]> {
    const prisma = await this.tenantConnection.getCurrentClient();
    const rows = await prisma.auditEvent.findMany({
      where: {
        eventType: { in: Object.keys(SEALING_EVENTS) },
        seq: { gt: afterSeq },
      },
      orderBy: { seq: 'asc' },
      take,
      select: {
        seq: true,
        eventType: true,
        occurredAt: true,
        caseId: true,
        payload: true,
      },
    });

    return rows.map((row) => ({
      seq: row.seq,
      eventType: row.eventType,
      occurredAt: row.occurredAt,
      caseId: row.caseId,
      payload: row.payload as Record<string, unknown>,
    }));
  }

  async readAnchorPoints(): Promise<AnchorPoint[]> {
    const prisma = await this.tenantConnection.getCurrentClient();
    const anchors = await prisma.auditAnchor.findMany({
      orderBy: [{ headSeq: 'asc' }, { id: 'asc' }],
      select: { headSeq: true, anchoredAt: true },
    });
    return anchors.map((anchor) => ({
      headSeq: anchor.headSeq,
      anchoredAt: anchor.anchoredAt,
    }));
  }
}
