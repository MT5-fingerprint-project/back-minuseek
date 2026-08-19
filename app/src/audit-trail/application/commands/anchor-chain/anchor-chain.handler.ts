import { Inject } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { createHash } from 'node:crypto';
import { AuditActor } from '../../../../shared/domain/audit/audit-actor.vo';
import { AuditEventTypeEnum } from '../../../../shared/domain/audit/audit-event-type.vo';
import { EvidenceClassEnum } from '../../../../shared/domain/audit/evidence-class.vo';
import {
  AUDIT_TRAIL,
  type AuditTrailPort,
} from '../../../../shared/domain/ports/audit-trail.port';
import {
  ID_GENERATOR,
  type IdGenerator,
} from '../../../../shared/domain/ports/id-generator';
import {
  TRANSACTION_RUNNER,
  type TransactionRunner,
} from '../../../../shared/domain/ports/transaction-runner';
import {
  CHAIN_ANCHOR_STORE,
  type ChainAnchorStore,
} from '../../ports/chain-anchor.store';
import {
  TIMESTAMP_AUTHORITY,
  type TimestampAuthorityPort,
} from '../../ports/timestamp-authority.port';
import {
  CHAIN_EVENT_READER,
  type ChainEventReader,
} from '../../queries/verify-chain/chain-event.reader';
import { AnchorChainCommand } from './anchor-chain.command';

const ANCHORING_ACTOR = AuditActor.system('anchoring');

export type AnchoringOutcome =
  | { status: 'anchored'; headSeq: number; genTime: Date }
  | {
      status: 'skipped';
      reason: 'chaîne vide' | 'rien de neuf depuis la dernière ancre';
    };

@CommandHandler(AnchorChainCommand)
export class AnchorChainHandler implements ICommandHandler<AnchorChainCommand> {
  constructor(
    @Inject(CHAIN_EVENT_READER)
    private readonly chainReader: ChainEventReader,
    @Inject(CHAIN_ANCHOR_STORE)
    private readonly anchors: ChainAnchorStore,
    @Inject(TIMESTAMP_AUTHORITY)
    private readonly timestampAuthority: TimestampAuthorityPort,
    @Inject(TRANSACTION_RUNNER)
    private readonly transactionRunner: TransactionRunner,
    @Inject(AUDIT_TRAIL)
    private readonly auditTrail: AuditTrailPort,
    @Inject(ID_GENERATOR)
    private readonly idGenerator: IdGenerator,
  ) {}

  async execute(): Promise<AnchoringOutcome> {
    const head = await this.chainReader.findHead();
    if (!head) {
      return { status: 'skipped', reason: 'chaîne vide' };
    }

    const lastAnchor = await this.anchors.findLast();
    if (lastAnchor && this.onlyAnchoringSince(lastAnchor.headSeq, head)) {
      return {
        status: 'skipped',
        reason: 'rien de neuf depuis la dernière ancre',
      };
    }

    // Aller-retour réseau hors transaction : sous l'advisory lock de la chaîne,
    // il bloquerait toutes les écritures du tenant pendant la latence TSA.
    const token = await this.timestampAuthority.timestamp(head.hash);

    await this.transactionRunner.run(async () => {
      await this.anchors.save({
        id: this.idGenerator.generate(),
        headSeq: head.seq,
        headHash: head.hash,
        tsaUrl: token.tsaUrl,
        tsaResponse: token.tsrDer,
        anchoredAt: token.genTime,
      });
      await this.auditTrail.append({
        eventType: AuditEventTypeEnum.CHAIN_ANCHORED,
        evidenceClass: EvidenceClassEnum.OBSERVED,
        actor: ANCHORING_ACTOR,
        payload: {
          headSeq: Number(head.seq),
          headHash: head.hash,
          tsaUrl: token.tsaUrl,
          tsrSha256: createHash('sha256').update(token.tsrDer).digest('hex'),
        },
      });
    });

    return {
      status: 'anchored',
      headSeq: Number(head.seq),
      genTime: token.genTime,
    };
  }

  /**
   * Le tapis roulant : l'ancrage appende lui-même un CHAIN_ANCHORED, donc la
   * tête bouge à chaque ancre. Sans cette condition, chaque ancre déclencherait
   * la suivante et un tenant inactif s'ancrerait à vie — une facture par heure
   * sur TSA qualifiée.
   */
  private onlyAnchoringSince(
    anchoredSeq: bigint,
    head: { seq: bigint; eventType: AuditEventTypeEnum },
  ): boolean {
    if (head.seq <= anchoredSeq) {
      return true;
    }
    return (
      head.seq === anchoredSeq + 1n &&
      head.eventType === AuditEventTypeEnum.CHAIN_ANCHORED
    );
  }
}
