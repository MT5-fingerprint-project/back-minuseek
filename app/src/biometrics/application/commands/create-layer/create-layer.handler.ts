import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { CreateLayerCommand } from './create-layer.command';
import { Layer } from '../../../domain/layer/entity/layer';
import { layerAuditPayload } from '../../../domain/layer/layer-audit-payload';
import { assertCaseAcceptsWork } from '../../../domain/case-work-window';
import { assertExpertAdjustmentAllowed } from '../../../domain/expert-adjustment';
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
import { CASE_STATUS, CaseStatusPort } from '../../ports/case-status.port';
import {
  CASE_EXPERTISE,
  CaseExpertisePort,
} from '../../ports/case-expertise.port';

@CommandHandler(CreateLayerCommand)
export class CreateLayerHandler implements ICommandHandler<CreateLayerCommand> {
  constructor(
    @Inject(LAYER_REPOSITORY) private readonly repository: LayerRepository,
    @Inject(FINGERPRINT_LOCATOR)
    private readonly fingerprintLocator: FingerprintLocatorPort,
    @Inject(CASE_STATUS)
    private readonly caseStatus: CaseStatusPort,
    @Inject(CASE_EXPERTISE)
    private readonly caseExpertise: CaseExpertisePort,
  ) {}

  async execute(command: CreateLayerCommand): Promise<void> {
    const location = await this.fingerprintLocator.locate(
      command.fingerprintId,
    );
    if (!location) throw new FingerprintNotFoundError(command.fingerprintId);
    assertCaseAcceptsWork(
      location.caseId,
      await this.caseStatus.findStatus(location.caseId),
    );
    assertExpertAdjustmentAllowed(
      location.caseId,
      command.settings,
      await this.caseExpertise.isUnderExpertise(location.caseId),
    );

    const layer = Layer.create({
      id: command.id,
      fingerprintId: command.fingerprintId,
      name: command.name,
      type: command.type,
      zIndex: command.zIndex,
      settings: command.settings,
    });
    await this.repository.save(layer, {
      eventType: AuditEventTypeEnum.LAYER_CREATED,
      evidenceClass: EvidenceClassEnum.OBSERVED,
      actor: command.actor,
      caseId: location.caseId,
      traceId: location.traceId,
      payload: layerAuditPayload(layer),
    });
  }
}
