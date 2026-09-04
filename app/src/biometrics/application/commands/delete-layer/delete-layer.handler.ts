import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { DeleteLayerCommand } from './delete-layer.command';
import { LayerNotAuthoredByVerifierError } from '../../../domain/layer/errors/layer-not-authored-by-verifier.error';
import { LayerNotFoundError } from '../../../domain/layer/errors/layer-not-found.error';
import { layerAuditPayload } from '../../../domain/layer/layer-audit-payload';
import { minutiaMarkOf, type MinutiaMark } from '../../../domain/layer/minutia';
import { assertCaseAcceptsWork } from '../../../domain/case-work-window';
import { FingerprintNotFoundError } from '../../../domain/fingerprint-not-found.error';
import {
  LAYER_REPOSITORY,
  type LayerRepository,
} from '../../../domain/layer/repository/layer.repository';
import type { MinutiaPair } from '../../../domain/minutia-pair/entity/minutia-pair';
import { minutiaPairAuditPayload } from '../../../domain/minutia-pair/minutia-pair-audit-payload';
import {
  MINUTIA_PAIR_REPOSITORY,
  type MinutiaPairRepository,
} from '../../../domain/minutia-pair/repository/minutia-pair.repository';
import { AuditEventTypeEnum } from '../../../../shared/domain/audit/audit-event-type.vo';
import { EvidenceClassEnum } from '../../../../shared/domain/audit/evidence-class.vo';
import type { AuditEventDraft } from '../../../../shared/domain/ports/audit-trail.port';
import {
  FINGERPRINT_LOCATOR,
  type FingerprintLocatorPort,
} from '../../ports/fingerprint-locator.port';
import { CASE_STATUS, CaseStatusPort } from '../../ports/case-status.port';

@CommandHandler(DeleteLayerCommand)
export class DeleteLayerHandler implements ICommandHandler<DeleteLayerCommand> {
  constructor(
    @Inject(LAYER_REPOSITORY) private readonly repository: LayerRepository,
    @Inject(MINUTIA_PAIR_REPOSITORY)
    private readonly pairs: MinutiaPairRepository,
    @Inject(FINGERPRINT_LOCATOR)
    private readonly fingerprintLocator: FingerprintLocatorPort,
    @Inject(CASE_STATUS)
    private readonly caseStatus: CaseStatusPort,
  ) {}

  async execute(command: DeleteLayerCommand): Promise<void> {
    const layer = await this.repository.findById(command.id);
    if (!layer) throw new LayerNotFoundError(command.id);
    if (
      command.verifierUserId !== null &&
      layer.createdByUserId !== command.verifierUserId
    ) {
      throw new LayerNotAuthoredByVerifierError(command.id);
    }

    const location = await this.fingerprintLocator.locate(layer.fingerprintId);
    if (!location) throw new FingerprintNotFoundError(layer.fingerprintId);
    assertCaseAcceptsWork(
      location.caseId,
      await this.caseStatus.findStatus(location.caseId),
    );

    const brokenPairs = await this.pairs.findByMinutiaLayerId(command.id);
    const unpairings: AuditEventDraft[] = [];
    for (const pair of brokenPairs) {
      unpairings.push(await this.unpairingAct(pair, command, location.caseId));
    }

    await this.repository.delete(command.id, [
      {
        eventType: AuditEventTypeEnum.LAYER_DELETED,
        evidenceClass: EvidenceClassEnum.OBSERVED,
        actor: command.actor,
        caseId: location.caseId,
        traceId: location.traceId,
        payload: layerAuditPayload(layer),
      },
      ...unpairings,
    ]);
  }

  private async unpairingAct(
    pair: MinutiaPair,
    command: DeleteLayerCommand,
    caseId: string,
  ): Promise<AuditEventDraft> {
    return {
      eventType: AuditEventTypeEnum.MINUTIA_UNPAIRED,
      evidenceClass: EvidenceClassEnum.OBSERVED,
      actor: command.actor,
      caseId,
      traceId: pair.traceId,
      payload: minutiaPairAuditPayload(
        pair,
        await this.markOf(pair.traceMinutiaLayerId),
        await this.markOf(pair.referenceMinutiaLayerId),
        'MINUTIA_DELETED',
      ),
    };
  }

  private async markOf(layerId: string): Promise<MinutiaMark | null> {
    const layer = await this.repository.findById(layerId);
    return layer === null ? null : minutiaMarkOf(layer);
  }
}
