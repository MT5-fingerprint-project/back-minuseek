import { Injectable } from '@nestjs/common';
import { TenantConnectionService } from '../../../tenancy/infrastructure/persistence/tenant-connection.service';
import { AuditActorPrimitives } from '../../../shared/domain/audit/audit-actor.vo';
import { AuditEventTypeEnum } from '../../../shared/domain/audit/audit-event-type.vo';
import { EvidenceClassEnum } from '../../../shared/domain/audit/evidence-class.vo';
import type {
  ChainEventReader,
  ChainEventRow,
} from '../../application/queries/verify-chain/chain-event.reader';

@Injectable()
export class PrismaChainEventReader implements ChainEventReader {
  constructor(private readonly tenantConnection: TenantConnectionService) {}

  async findBatchAfter(seq: bigint, take: number): Promise<ChainEventRow[]> {
    const prisma = await this.tenantConnection.getCurrentClient();
    const rows = await prisma.auditEvent.findMany({
      where: { seq: { gt: seq } },
      orderBy: { seq: 'asc' },
      take,
    });

    return rows.map((row) => ({
      seq: row.seq,
      eventType: row.eventType as AuditEventTypeEnum,
      evidenceClass: row.evidenceClass as EvidenceClassEnum,
      actor: row.actor as unknown as AuditActorPrimitives,
      caseId: row.caseId,
      traceId: row.traceId,
      payload: row.payload as Record<string, unknown>,
      occurredAt: row.occurredAt,
      prevHash: row.prevHash,
      hash: row.hash,
    }));
  }
}
