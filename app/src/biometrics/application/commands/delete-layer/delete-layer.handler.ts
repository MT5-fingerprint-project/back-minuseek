import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { DeleteLayerCommand } from './delete-layer.command';
import { LayerNotAuthoredByVerifierError } from '../../../domain/layer/errors/layer-not-authored-by-verifier.error';
import { LayerNotFoundError } from '../../../domain/layer/errors/layer-not-found.error';
import { layerAuditPayload } from '../../../domain/layer/layer-audit-payload';
import { assertCaseAcceptsWork } from '../../../domain/case-work-window';
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

@CommandHandler(DeleteLayerCommand)
export class DeleteLayerHandler implements ICommandHandler<DeleteLayerCommand> {
  constructor(
    @Inject(LAYER_REPOSITORY) private readonly repository: LayerRepository,
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

    await this.repository.delete(command.id, {
      eventType: AuditEventTypeEnum.LAYER_DELETED,
      evidenceClass: EvidenceClassEnum.OBSERVED,
      actor: command.actor,
      caseId: location.caseId,
      traceId: location.traceId,
      payload: layerAuditPayload(layer),
    });
  }
}
