import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { AuditEventTypeEnum } from '../../../../shared/domain/audit/audit-event-type.vo';
import { EvidenceClassEnum } from '../../../../shared/domain/audit/evidence-class.vo';
import {
  numberMinutiaPairs,
  resolvePairType,
} from '../../../../shared/domain/forensics/minutia-pairing';
import type { MinutiaTypeEnum } from '../../../../shared/domain/forensics/minutiae';
import {
  ID_GENERATOR,
  type IdGenerator,
} from '../../../../shared/domain/ports/id-generator';
import {
  TRANSACTION_RUNNER,
  type TransactionRunner,
} from '../../../../shared/domain/ports/transaction-runner';
import { assertCaseAcceptsWork } from '../../../domain/case-work-window';
import { FingerprintNotFoundError } from '../../../domain/fingerprint-not-found.error';
import type { Layer } from '../../../domain/layer/entity/layer';
import { LayerNotAuthoredByVerifierError } from '../../../domain/layer/errors/layer-not-authored-by-verifier.error';
import { LayerNotFoundError } from '../../../domain/layer/errors/layer-not-found.error';
import { layerAuditPayload } from '../../../domain/layer/layer-audit-payload';
import { isMinutiaLayer, minutiaMarkOf } from '../../../domain/layer/minutia';
import {
  LAYER_REPOSITORY,
  type LayerRepository,
} from '../../../domain/layer/repository/layer.repository';
import { MinutiaPair } from '../../../domain/minutia-pair/entity/minutia-pair';
import { IncompatibleMinutiaTypesError } from '../../../domain/minutia-pair/errors/incompatible-minutia-types.error';
import { MinutiaOutsidePieceError } from '../../../domain/minutia-pair/errors/minutia-outside-piece.error';
import { MinutiaPairNotFoundError } from '../../../domain/minutia-pair/errors/minutia-pair-not-found.error';
import { NotAMinutiaLayerError } from '../../../domain/minutia-pair/errors/not-a-minutia-layer.error';
import { PiecesNotInSameCaseError } from '../../../domain/minutia-pair/errors/pieces-not-in-same-case.error';
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
import type { MinutiaPairReadModel } from '../../queries/list-minutia-pairs/minutia-pair-read-model';
import {
  MINUTIA_PAIR_READER,
  type MinutiaPairReader,
} from '../../queries/list-minutia-pairs/minutia-pair.reader';
import { CreateMinutiaPairCommand } from './create-minutia-pair.command';

@CommandHandler(CreateMinutiaPairCommand)
export class CreateMinutiaPairHandler implements ICommandHandler<
  CreateMinutiaPairCommand,
  MinutiaPairReadModel
> {
  constructor(
    @Inject(LAYER_REPOSITORY) private readonly layers: LayerRepository,
    @Inject(MINUTIA_PAIR_REPOSITORY)
    private readonly pairs: MinutiaPairRepository,
    @Inject(MINUTIA_PAIR_READER) private readonly reader: MinutiaPairReader,
    @Inject(FINGERPRINT_LOCATOR)
    private readonly locator: FingerprintLocatorPort,
    @Inject(CASE_STATUS) private readonly caseStatus: CaseStatusPort,
    @Inject(ID_GENERATOR) private readonly idGenerator: IdGenerator,
    @Inject(TRANSACTION_RUNNER)
    private readonly transactionRunner: TransactionRunner,
  ) {}

  async execute(
    command: CreateMinutiaPairCommand,
  ): Promise<MinutiaPairReadModel> {
    const traceLocation = await this.locator.locate(command.traceId);
    if (!traceLocation) throw new FingerprintNotFoundError(command.traceId);
    const printLocation = await this.locator.locate(command.referencePrintId);
    if (!printLocation) {
      throw new FingerprintNotFoundError(command.referencePrintId);
    }
    if (traceLocation.caseId !== printLocation.caseId) {
      throw new PiecesNotInSameCaseError(
        command.traceId,
        command.referencePrintId,
      );
    }
    assertCaseAcceptsWork(
      traceLocation.caseId,
      await this.caseStatus.findStatus(traceLocation.caseId),
    );

    const traceMinutia = await this.readMinutia(
      command.traceMinutiaLayerId,
      command.traceId,
      command.blindVerifierUserId,
    );
    const referenceMinutia = await this.readMinutia(
      command.referenceMinutiaLayerId,
      command.referencePrintId,
      command.blindVerifierUserId,
    );

    const decision = resolvePairType(
      minutiaMarkOf(traceMinutia).minutiaType,
      minutiaMarkOf(referenceMinutia).minutiaType,
    );
    if (decision.outcome === 'REFUSED') {
      throw new IncompatibleMinutiaTypesError(
        decision.traceType,
        decision.referenceType,
      );
    }

    const pair = MinutiaPair.fromPrimitives({
      id: this.idGenerator.generate(),
      traceId: command.traceId,
      referencePrintId: command.referencePrintId,
      traceMinutiaLayerId: command.traceMinutiaLayerId,
      referenceMinutiaLayerId: command.referenceMinutiaLayerId,
      createdByUserId: command.createdByUserId,
      createdAt: new Date(),
    });

    await this.transactionRunner.run(async () => {
      if (decision.outcome === 'QUALIFIES') {
        await this.qualify(
          decision.sideToQualify === 'TRACE' ? traceMinutia : referenceMinutia,
          decision.type,
          command,
          traceLocation.caseId,
        );
      }
      await this.pairs.save(pair, {
        eventType: AuditEventTypeEnum.MINUTIA_PAIRED,
        evidenceClass: EvidenceClassEnum.OBSERVED,
        actor: command.actor,
        caseId: traceLocation.caseId,
        traceId: command.traceId,
        payload: minutiaPairAuditPayload(
          pair,
          minutiaMarkOf(traceMinutia),
          minutiaMarkOf(referenceMinutia),
        ),
      });
    });

    return {
      ...(await this.numberOf(pair, command)),
      traceMinutiaLayerId: pair.traceMinutiaLayerId,
      referenceMinutiaLayerId: pair.referenceMinutiaLayerId,
      minutiaType: decision.type,
    };
  }

  // Apparier écrit sur les deux minuties : la branche QUALIFIES réécrit le type
  // de celle qui reste indéterminée, et la paire verrouille ensuite les deux
  // contre toute requalification. Un vérificateur en aveugle n'y touche donc pas
  // plus qu'il ne touche à un calque de l'opérateur.
  private async readMinutia(
    layerId: string,
    expectedFingerprintId: string,
    blindVerifierUserId: string | null,
  ): Promise<Layer> {
    const layer = await this.layers.findById(layerId);
    if (!layer) throw new LayerNotFoundError(layerId);
    if (!isMinutiaLayer(layer)) throw new NotAMinutiaLayerError(layerId);
    if (layer.fingerprintId !== expectedFingerprintId) {
      throw new MinutiaOutsidePieceError(layerId, expectedFingerprintId);
    }
    if (
      blindVerifierUserId !== null &&
      layer.createdByUserId !== blindVerifierUserId
    ) {
      throw new LayerNotAuthoredByVerifierError(layerId);
    }
    return layer;
  }

  private async qualify(
    layer: Layer,
    minutiaType: MinutiaTypeEnum,
    command: CreateMinutiaPairCommand,
    caseId: string,
  ): Promise<void> {
    const previousMinutiaType = minutiaMarkOf(layer).minutiaType;
    layer.update({
      settings: { ...layer.toPrimitives().settings, minutiaType },
    });
    await this.layers.save(layer, {
      eventType: AuditEventTypeEnum.LAYER_UPDATED,
      evidenceClass: EvidenceClassEnum.OBSERVED,
      actor: command.actor,
      caseId,
      traceId: command.traceId,
      payload: { ...layerAuditPayload(layer), previousMinutiaType },
    });
  }

  private async numberOf(
    pair: MinutiaPair,
    command: CreateMinutiaPairCommand,
  ): Promise<{ id: string; number: number }> {
    const rows = await this.reader.findByTraceAndReferencePrint(
      command.traceId,
      command.referencePrintId,
      command.blindVerifierUserId,
    );
    const numbered = numberMinutiaPairs(rows);
    const created = numbered.find((row) => row.id === pair.id);
    if (!created) throw new MinutiaPairNotFoundError(pair.id);
    return { id: pair.id, number: created.number };
  }
}
