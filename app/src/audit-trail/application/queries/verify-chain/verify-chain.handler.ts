import { Inject } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { AuditActor } from '../../../../shared/domain/audit/audit-actor.vo';
import {
  GENESIS_PREV_HASH,
  GENESIS_SEQ,
} from '../../../domain/audit-event/entity/audit-event';
import {
  canonicalEventJson,
  computeEventHash,
} from '../../../domain/services/audit-event-hash';
import {
  CHAIN_ANCHOR_STORE,
  type ChainAnchorRecord,
  type ChainAnchorStore,
} from '../../ports/chain-anchor.store';
import {
  TIMESTAMP_VERIFIER,
  type TimestampVerifierPort,
} from '../../ports/timestamp-verifier.port';
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
    @Inject(CHAIN_ANCHOR_STORE)
    private readonly anchors: ChainAnchorStore,
    @Inject(TIMESTAMP_VERIFIER)
    private readonly timestampVerifier: TimestampVerifierPort,
  ) {}

  async execute(): Promise<ChainVerificationReport> {
    const links = await this.verifyLinks();
    const anchors = await this.verifyAnchors();

    return {
      ...links,
      ...anchors,
      ok:
        links.ok && anchors.anchors.failed === 0 && !anchors.truncatedBelowSeq,
    };
  }

  private async verifyLinks(): Promise<{
    ok: boolean;
    eventsChecked: number;
    firstBrokenSeq?: number;
  }> {
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

  private async verifyAnchors(): Promise<{
    anchors: { verified: number; failed: number };
    truncatedBelowSeq?: number;
  }> {
    const anchors = await this.anchors.list();
    if (anchors.length === 0) {
      return { anchors: { verified: 0, failed: 0 } };
    }

    let verified = 0;
    let failed = 0;
    for (const anchor of anchors) {
      if (await this.isAnchorHonest(anchor)) {
        verified += 1;
      } else {
        failed += 1;
      }
    }

    // Supprimer les k derniers maillons laisse une chaîne parfaitement
    // continue : seule la comparaison à la dernière ancre le voit.
    const head = await this.reader.findHead();
    const lastAnchoredSeq = anchors[anchors.length - 1].headSeq;
    const truncated = !head || head.seq < lastAnchoredSeq;

    return {
      anchors: { verified, failed },
      ...(truncated ? { truncatedBelowSeq: Number(lastAnchoredSeq) } : {}),
    };
  }

  /**
   * Trois questions par ancre, dont deux que la seule vérification du TSR ne
   * pose pas : l'ancre désigne-t-elle un maillon qui existe encore, ce maillon
   * porte-t-il le hash ancré, et le TSR horodate-t-il bien ce maillon-là ?
   * Sans la confrontation à la chaîne, une chaîne entièrement réécrite passe au
   * vert — hashes recalculés cohérents, TSR valides, et rien qui les relie.
   */
  private async isAnchorHonest(anchor: ChainAnchorRecord): Promise<boolean> {
    const anchored = await this.reader.findBySeq(anchor.headSeq);
    if (!anchored || anchored.hash !== anchor.headHash) {
      return false;
    }

    let timestampedData: Buffer;
    try {
      timestampedData = Buffer.from(
        canonicalEventJson({
          ...anchored,
          actor: AuditActor.reconstitute(anchored.actor),
        }),
        'utf8',
      );
    } catch {
      return false;
    }

    return this.timestampVerifier.verifyOverData(
      anchor.tsaResponse,
      timestampedData,
    );
  }
}
