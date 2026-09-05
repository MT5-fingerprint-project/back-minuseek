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
import type { MinutiaTypeEnum } from '../../../../shared/domain/forensics/minutiae';
import {
  TRANSACTION_RUNNER,
  type TransactionRunner,
} from '../../../../shared/domain/ports/transaction-runner';
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
import {
  MINUTIA_PAIR_REPOSITORY,
  type MinutiaPairRepository,
} from '../../../domain/minutia-pair/repository/minutia-pair.repository';

/** L'autre minutie d'une paire, rattachée à la trace qui porte l'appariement. */
type PairedPartner = {
  layer: Layer;
  traceId: string;
  minutiaType: MinutiaTypeEnum;
};

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
    @Inject(TRANSACTION_RUNNER)
    private readonly transactionRunner: TransactionRunner,
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

    const requalifiedType = this.requalifiedType(layer, command);
    const partners =
      requalifiedType === null
        ? []
        : await this.partnersOf(layer, requalifiedType, command);

    layer.update({
      name: command.name,
      zIndex: command.zIndex,
      isVisible: command.isVisible,
      settings: command.settings,
    });
    await this.transactionRunner.run(async () => {
      await this.repository.save(layer, {
        eventType: AuditEventTypeEnum.LAYER_UPDATED,
        evidenceClass: EvidenceClassEnum.OBSERVED,
        actor: command.actor,
        caseId: location.caseId,
        traceId: location.traceId,
        payload: layerAuditPayload(layer),
      });
      for (const partner of partners) {
        await this.requalify(partner, command, location.caseId);
      }
    });
  }

  /** Le type visé, ou `null` quand l'acte ne change pas celui de la minutie. */
  private requalifiedType(
    layer: Layer,
    command: UpdateLayerCommand,
  ): MinutiaTypeEnum | null {
    if (command.settings === undefined) return null;
    const wanted = minutiaTypeOf(command.settings);
    return wanted === minutiaTypeOf(layer.toPrimitives().settings)
      ? null
      : wanted;
  }

  /**
   * Une paire porte un seul type : requalifier l'une de ses minuties requalifie
   * l'autre, sinon le rapport lirait sur la trace un type que l'empreinte dément.
   */
  private async partnersOf(
    layer: Layer,
    minutiaType: MinutiaTypeEnum,
    command: UpdateLayerCommand,
  ): Promise<PairedPartner[]> {
    const partners: PairedPartner[] = [];
    for (const pair of await this.pairs.findByMinutiaLayerId(layer.id)) {
      const partnerId =
        pair.traceMinutiaLayerId === layer.id
          ? pair.referenceMinutiaLayerId
          : pair.traceMinutiaLayerId;
      const partner = await this.repository.findById(partnerId);
      if (!partner) throw new LayerNotFoundError(partnerId);
      if (
        command.verifierUserId !== null &&
        partner.createdByUserId !== command.verifierUserId
      ) {
        throw new LayerNotAuthoredByVerifierError(partnerId);
      }
      if (minutiaTypeOf(partner.toPrimitives().settings) === minutiaType) {
        continue;
      }
      partners.push({ layer: partner, traceId: pair.traceId, minutiaType });
    }
    return partners;
  }

  private async requalify(
    partner: PairedPartner,
    command: UpdateLayerCommand,
    caseId: string,
  ): Promise<void> {
    const settings = partner.layer.toPrimitives().settings;
    const previousMinutiaType = minutiaTypeOf(settings);
    partner.layer.update({
      settings: { ...settings, minutiaType: partner.minutiaType },
    });
    await this.repository.save(partner.layer, {
      eventType: AuditEventTypeEnum.LAYER_UPDATED,
      evidenceClass: EvidenceClassEnum.OBSERVED,
      actor: command.actor,
      caseId,
      traceId: partner.traceId,
      payload: { ...layerAuditPayload(partner.layer), previousMinutiaType },
    });
  }
}
