import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { UpdateLayerCommand } from './update-layer.command';
import { LayerNotFoundError } from '../../../domain/layer/errors/layer-not-found.error';
import { layerAuditPayload } from '../../../domain/layer/layer-audit-payload';
import { FingerprintNotFoundError } from '../../../domain/fingerprint-not-found.error';
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

@CommandHandler(UpdateLayerCommand)
export class UpdateLayerHandler implements ICommandHandler<UpdateLayerCommand> {
  constructor(
    @Inject(LAYER_REPOSITORY) private readonly repository: LayerRepository,
    @Inject(FINGERPRINT_LOCATOR)
    private readonly fingerprintLocator: FingerprintLocatorPort,
  ) {}

  async execute(command: UpdateLayerCommand): Promise<void> {
    const layer = await this.repository.findById(command.id);
    if (!layer) throw new LayerNotFoundError(command.id);

    const location = await this.fingerprintLocator.locate(layer.fingerprintId);
    if (!location) throw new FingerprintNotFoundError(layer.fingerprintId);

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
}
