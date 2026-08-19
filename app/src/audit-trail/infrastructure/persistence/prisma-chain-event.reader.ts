import { Injectable } from '@nestjs/common';
import { TenantConnectionService } from '../../../tenancy/infrastructure/persistence/tenant-connection.service';
import { AuditActorPrimitives } from '../../../shared/domain/audit/audit-actor.vo';
import { AuditEventTypeEnum } from '../../../shared/domain/audit/audit-event-type.vo';
import { EvidenceClassEnum } from '../../../shared/domain/audit/evidence-class.vo';
import type {
  ChainEventReader,
  ChainEventRow,
  ChainHead,
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

    return rows.map((row) => toRow(row));
  }

  async findHead(): Promise<ChainHead | null> {
    const prisma = await this.tenantConnection.getCurrentClient();
    const row = await prisma.auditEvent.findFirst({
      orderBy: { seq: 'desc' },
      select: { seq: true, hash: true, eventType: true },
    });
    if (!row) {
      return null;
    }
    return {
      seq: row.seq,
      hash: row.hash,
      eventType: row.eventType as AuditEventTypeEnum,
    };
  }

  async findBySeq(seq: bigint): Promise<ChainEventRow | null> {
    const prisma = await this.tenantConnection.getCurrentClient();
    const row = await prisma.auditEvent.findUnique({ where: { seq } });
    return row ? toRow(row) : null;
  }
}

interface AuditEventRow {
  seq: bigint;
  eventType: string;
  evidenceClass: string;
  actor: unknown;
  caseId: string | null;
  traceId: string | null;
  payload: unknown;
  occurredAt: Date;
  prevHash: string;
  hash: string;
}

function toRow(row: AuditEventRow): ChainEventRow {
  return {
    seq: row.seq,
    eventType: row.eventType as AuditEventTypeEnum,
    evidenceClass: row.evidenceClass as EvidenceClassEnum,
    actor: row.actor as AuditActorPrimitives,
    caseId: row.caseId,
    traceId: row.traceId,
    payload: row.payload as Record<string, unknown>,
    occurredAt: row.occurredAt,
    prevHash: row.prevHash,
    hash: row.hash,
  };
}
