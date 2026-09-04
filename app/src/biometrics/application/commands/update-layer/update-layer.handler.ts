import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { UpdateLayerCommand } from './update-layer.command';
import { LayerNotAuthoredByVerifierError } from '../../../domain/layer/errors/layer-not-authored-by-verifier.error';
import { LayerNotFoundError } from '../../../domain/layer/errors/layer-not-found.error';
import { layerAuditPayload } from '../../../domain/layer/layer-audit-payload';
import { assertCaseAcceptsWork } from '../../../domain/case-work-window';
import { assertExpertAdjustmentAllowed } from '../../../domain/expert-adjustment';
import { FingerprintNotFoundError } from '../../../domain/fingerprint-not-found.error';
import type { Layer } from '../../../domain/layer/entity/layer';
import {
  LAYER_REPOSITORY,
  type LayerRepository,
} from '../../../domain/layer/repository/layer.repository';
import { AuditEventTypeEnum } from '../../../../shared/domain/audit/audit-event-type.vo';
import { EvidenceClassEnum } from '../../../../shared/domain/audit/evidence-class.vo';
import {
  FINGERPRINT_LOCATOR,
  type FingerprintLocatorPort,
} from '../../ports/fingerprint-locator.port';
import { CASE_STATUS, CaseStatusPort } from '../../ports/case-status.port';
import {
  CASE_EXPERTISE,
  CaseExpertisePort,
} from '../../ports/case-expertise.port';
import { minutiaTypeOf } from '../../../domain/layer/minutia';
import { PairedMinutiaTypeChangeError } from '../../../domain/minutia-pair/errors/paired-minutia-type-change.error';
import {
  MINUTIA_PAIR_REPOSITORY,
  type MinutiaPairRepository,
} from '../../../domain/minutia-pair/repository/minutia-pair.repository';

@CommandHandler(UpdateLayerCommand)
export class UpdateLayerHandler implements ICommandHandler<UpdateLayerCommand> {
  constructor(
    @Inject(LAYER_REPOSITORY) private readonly repository: LayerRepository,
    @Inject(MINUTIA_PAIR_REPOSITORY)
    private readonly pairs: MinutiaPairRepository,
    @Inject(FINGERPRINT_LOCATOR)
    private readonly fingerprintLocator: FingerprintLocatorPort,
    @Inject(CASE_STATUS)
    private readonly caseStatus: CaseStatusPort,
    @Inject(CASE_EXPERTISE)
    private readonly caseExpertise: CaseExpertisePort,
  ) {}

  async execute(command: UpdateLayerCommand): Promise<void> {
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
    assertExpertAdjustmentAllowed(
      location.caseId,
      command.settings,
      await this.caseExpertise.isUnderExpertise(location.caseId),
    );

    await this.assertTypeStillFree(layer, command);

    layer.update({
      name: command.name,
      zIndex: command.zIndex,
      isVisible: command.isVisible,
      settings: command.settings,
    });
    await this.repository.save(layer, {
      eventType: AuditEventTypeEnum.LAYER_UPDATED,
      evidenceClass: EvidenceClassEnum.OBSERVED,
      actor: command.actor,
      caseId: location.caseId,
      traceId: location.traceId,
      payload: layerAuditPayload(layer),
    });
  }

  private async assertTypeStillFree(
    layer: Layer,
    command: UpdateLayerCommand,
  ): Promise<void> {
    if (command.settings === undefined) {
      return;
    }
    const currentType = minutiaTypeOf(layer.toPrimitives().settings);
    if (minutiaTypeOf(command.settings) === currentType) {
      return;
    }
    const pairs = await this.pairs.findByMinutiaLayerId(command.id);
    if (pairs.length > 0) {
      throw new PairedMinutiaTypeChangeError(command.id);
    }
  }
}
