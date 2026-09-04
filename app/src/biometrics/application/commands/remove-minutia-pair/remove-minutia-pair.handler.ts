import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { AuditEventTypeEnum } from '../../../../shared/domain/audit/audit-event-type.vo';
import { EvidenceClassEnum } from '../../../../shared/domain/audit/evidence-class.vo';
import { assertCaseAcceptsWork } from '../../../domain/case-work-window';
import { FingerprintNotFoundError } from '../../../domain/fingerprint-not-found.error';
import { minutiaMarkOf, type MinutiaMark } from '../../../domain/layer/minutia';
import {
  LAYER_REPOSITORY,
  type LayerRepository,
} from '../../../domain/layer/repository/layer.repository';
import { MinutiaPairNotAuthoredByVerifierError } from '../../../domain/minutia-pair/errors/minutia-pair-not-authored-by-verifier.error';
import { MinutiaPairNotFoundError } from '../../../domain/minutia-pair/errors/minutia-pair-not-found.error';
import { minutiaPairAuditPayload } from '../../../domain/minutia-pair/minutia-pair-audit-payload';
import {
  MINUTIA_PAIR_REPOSITORY,
  type MinutiaPairRepository,
} from '../../../domain/minutia-pair/repository/minutia-pair.repository';
import { CASE_STATUS, type CaseStatusPort } from '../../ports/case-status.port';
import {
  FINGERPRINT_LOCATOR,
  type FingerprintLocatorPort,
} from '../../ports/fingerprint-locator.port';
import { RemoveMinutiaPairCommand } from './remove-minutia-pair.command';

@CommandHandler(RemoveMinutiaPairCommand)
export class RemoveMinutiaPairHandler implements ICommandHandler<
  RemoveMinutiaPairCommand,
  void
> {
  constructor(
    @Inject(LAYER_REPOSITORY) private readonly layers: LayerRepository,
    @Inject(MINUTIA_PAIR_REPOSITORY)
    private readonly pairs: MinutiaPairRepository,
    @Inject(FINGERPRINT_LOCATOR)
    private readonly locator: FingerprintLocatorPort,
    @Inject(CASE_STATUS) private readonly caseStatus: CaseStatusPort,
  ) {}

  async execute(command: RemoveMinutiaPairCommand): Promise<void> {
    const pair = await this.pairs.findById(command.pairId);
    if (!pair || pair.traceId !== command.traceId) {
      throw new MinutiaPairNotFoundError(command.pairId);
    }
    if (
      command.verifierUserId !== null &&
      pair.createdByUserId !== command.verifierUserId
    ) {
      throw new MinutiaPairNotAuthoredByVerifierError(command.pairId);
    }

    const location = await this.locator.locate(pair.traceId);
    if (!location) throw new FingerprintNotFoundError(pair.traceId);
    assertCaseAcceptsWork(
      location.caseId,
      await this.caseStatus.findStatus(location.caseId),
    );

    await this.pairs.delete(pair.id, {
      eventType: AuditEventTypeEnum.MINUTIA_UNPAIRED,
      evidenceClass: EvidenceClassEnum.OBSERVED,
      actor: command.actor,
      caseId: location.caseId,
      traceId: pair.traceId,
      payload: minutiaPairAuditPayload(
        pair,
        await this.markOf(pair.traceMinutiaLayerId),
        await this.markOf(pair.referenceMinutiaLayerId),
        'OPERATOR',
      ),
    });
  }

  private async markOf(layerId: string): Promise<MinutiaMark | null> {
    const layer = await this.layers.findById(layerId);
    return layer === null ? null : minutiaMarkOf(layer);
  }
}
