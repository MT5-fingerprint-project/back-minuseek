import { Inject } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { AuditActor } from '../../../../shared/domain/audit/audit-actor.vo';
import {
  GENESIS_PREV_HASH,
  GENESIS_SEQ,
} from '../../../domain/audit-event/entity/audit-event';
import { computeEventHash } from '../../../domain/services/audit-event-hash';
import { ChainVerificationReport } from './chain-verification-report';
import {
  CHAIN_EVENT_READER,
  ChainEventReader,
  ChainEventRow,
} from './chain-event.reader';
import { VerifyChainQuery } from './verify-chain.query';

export const VERIFICATION_BATCH_SIZE = 500;

function recomputeHash(row: ChainEventRow): string | null {
  try {
    return computeEventHash({
      seq: row.seq,
      eventType: row.eventType,
      evidenceClass: row.evidenceClass,
      actor: AuditActor.reconstitute(row.actor),
      caseId: row.caseId,
      traceId: row.traceId,
      payload: row.payload,
      occurredAt: row.occurredAt,
      prevHash: row.prevHash,
    });
  } catch {
    // Un maillon dont l'acteur ou la date ne se relit plus est corrompu, pas
    // une panne du vérificateur : il doit sortir en rupture, pas en exception.
    return null;
  }
}

@QueryHandler(VerifyChainQuery)
export class VerifyChainHandler implements IQueryHandler<VerifyChainQuery> {
  constructor(
    @Inject(CHAIN_EVENT_READER)
    private readonly reader: ChainEventReader,
  ) {}

  async execute(): Promise<ChainVerificationReport> {
    let expectedSeq = GENESIS_SEQ;
    let expectedPrevHash = GENESIS_PREV_HASH;
    let eventsChecked = 0;

    for (;;) {
      const batch = await this.reader.findBatchAfter(
        expectedSeq - 1n,
        VERIFICATION_BATCH_SIZE,
      );
      if (batch.length === 0) {
        return { ok: true, eventsChecked };
      }

      for (const row of batch) {
        const isChained =
          row.seq === expectedSeq &&
          row.prevHash === expectedPrevHash &&
          recomputeHash(row) === row.hash;
        if (!isChained) {
          return { ok: false, eventsChecked, firstBrokenSeq: Number(row.seq) };
        }
        eventsChecked += 1;
        expectedSeq = row.seq + 1n;
        expectedPrevHash = row.hash;
      }
    }
  }
}
