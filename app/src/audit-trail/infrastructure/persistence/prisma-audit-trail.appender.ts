import { Inject, Injectable } from '@nestjs/common';
import type { Prisma } from '../../../../generated/prisma/client';
import { AuditEventType } from '../../../shared/domain/audit/audit-event-type.vo';
import { EvidenceClass } from '../../../shared/domain/audit/evidence-class.vo';
import {
  AuditEventDraft,
  AuditTrailPort,
} from '../../../shared/domain/ports/audit-trail.port';
import {
  ID_GENERATOR,
  IdGenerator,
} from '../../../shared/domain/ports/id-generator';
import {
  AuditEvent,
  GENESIS_PREV_HASH,
  GENESIS_SEQ,
} from '../../domain/audit-event/entity/audit-event';
import { computeEventHash } from '../../domain/services/audit-event-hash';
import { TransactionContextService } from '../../../tenancy/infrastructure/persistence/transaction-context.service';
import { AuditAppendOutsideTransactionError } from './audit-append-outside-transaction.error';

@Injectable()
export class PrismaAuditTrailAppender implements AuditTrailPort {
  constructor(
    private readonly transactionContext: TransactionContextService,
    @Inject(ID_GENERATOR)
    private readonly idGenerator: IdGenerator,
  ) {}

  async append(draft: AuditEventDraft): Promise<void> {
    const transaction = this.transactionContext.getCurrentTransaction();
    if (!transaction) {
      throw new AuditAppendOutsideTransactionError(draft.eventType);
    }

    // Sérialise les appends de la base tenant : sans verrou, deux transactions
    // concurrentes liraient la même tête et fourcheraient la chaîne. Relâché
    // automatiquement au commit/rollback (variante _xact_).
    await transaction.$queryRaw`SELECT pg_advisory_xact_lock(hashtext('audit_chain'))`;

    const head = await transaction.auditEvent.findFirst({
      orderBy: { seq: 'desc' },
      select: { seq: true, hash: true },
    });

    const seq = head ? head.seq + 1n : GENESIS_SEQ;
    const prevHash = head ? head.hash : GENESIS_PREV_HASH;
    const occurredAt = new Date();
    const hash = computeEventHash({
      seq,
      eventType: draft.eventType,
      evidenceClass: draft.evidenceClass,
      actor: draft.actor,
      caseId: draft.caseId ?? null,
      traceId: draft.traceId ?? null,
      payload: draft.payload,
      occurredAt,
      prevHash,
    });

    const event = AuditEvent.chain({
      id: this.idGenerator.generate(),
      seq,
      eventType: AuditEventType.from(draft.eventType),
      evidenceClass: EvidenceClass.from(draft.evidenceClass),
      actor: draft.actor,
      caseId: draft.caseId,
      traceId: draft.traceId,
      payload: draft.payload,
      occurredAt,
      prevHash,
      hash,
    });

    const primitives = event.toPrimitives();
    await transaction.auditEvent.create({
      data: {
        id: primitives.id,
        seq: primitives.seq,
        eventType: primitives.eventType,
        evidenceClass: primitives.evidenceClass,
        actor: primitives.actor as unknown as Prisma.InputJsonValue,
        payload: primitives.payload as Prisma.InputJsonValue,
        caseId: primitives.caseId,
        traceId: primitives.traceId,
        occurredAt: primitives.occurredAt,
        prevHash: primitives.prevHash,
        hash: primitives.hash,
      },
    });
  }
}
