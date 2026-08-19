import { Injectable } from '@nestjs/common';
import { TenantConnectionService } from '../../../tenancy/infrastructure/persistence/tenant-connection.service';
import { AuditActorPrimitives } from '../../../shared/domain/audit/audit-actor.vo';
import { AuditEventTypeEnum } from '../../../shared/domain/audit/audit-event-type.vo';
import { EvidenceClassEnum } from '../../../shared/domain/audit/evidence-class.vo';
import { CaseAuditEventReadModel } from '../../application/queries/list-case-audit-events/case-audit-event-read-model';
import type { CaseAuditEventReader } from '../../application/queries/list-case-audit-events/case-audit-event.reader';

interface AuditEventRow {
  seq: bigint;
  eventType: string;
  evidenceClass: string;
  actor: unknown;
  occurredAt: Date;
  payload: unknown;
}

function toReadModel(row: AuditEventRow): CaseAuditEventReadModel {
  const actor = row.actor as AuditActorPrimitives;
  return {
    seq: Number(row.seq),
    eventType: row.eventType as AuditEventTypeEnum,
    evidenceClass: row.evidenceClass as EvidenceClassEnum,
    actor: { displayName: actor.displayName, username: actor.username },
    occurredAt: row.occurredAt,
    payload: row.payload as Record<string, unknown>,
  };
}

@Injectable()
export class PrismaCaseAuditEventReader implements CaseAuditEventReader {
  constructor(private readonly tenantConnection: TenantConnectionService) {}

  async findByCase(
    caseId: string,
    filters: { eventType?: AuditEventTypeEnum },
    pagination: { skip: number; take: number },
  ): Promise<{ items: CaseAuditEventReadModel[]; total: number }> {
    const prisma = await this.tenantConnection.getCurrentClient();
    const where = filters.eventType
      ? { caseId, eventType: filters.eventType }
      : { caseId };

    const [rows, total] = await Promise.all([
      prisma.auditEvent.findMany({
        where,
        skip: pagination.skip,
        take: pagination.take,
        orderBy: { seq: 'desc' },
        select: {
          seq: true,
          eventType: true,
          evidenceClass: true,
          actor: true,
          occurredAt: true,
          payload: true,
        },
      }),
      prisma.auditEvent.count({ where }),
    ]);

    return { items: rows.map(toReadModel), total };
  }
}
