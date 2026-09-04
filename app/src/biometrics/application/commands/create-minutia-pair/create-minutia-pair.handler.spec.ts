import { EXPERT_ACTOR } from '../../../../shared/domain/audit/audit-actor.fixture';
import { AuditEventTypeEnum } from '../../../../shared/domain/audit/audit-event-type.vo';
import { EvidenceClassEnum } from '../../../../shared/domain/audit/evidence-class.vo';
import { MinutiaTypeEnum } from '../../../../shared/domain/forensics/minutiae';
import { InMemoryAuditTrailAppender } from '../../../../audit-trail/infrastructure/persistence/in-memory-audit-trail.appender';
import { InMemoryTransactionRunner } from '../../../../tenancy/infrastructure/persistence/in-memory-transaction-runner';
import { Layer, type LayerSettings } from '../../../domain/layer/entity/layer';
import { LayerNotAuthoredByVerifierError } from '../../../domain/layer/errors/layer-not-authored-by-verifier.error';
import { LayerNotFoundError } from '../../../domain/layer/errors/layer-not-found.error';
import { CaseNotOpenForWorkError } from '../../../domain/errors/case-not-open-for-work.error';
import { FingerprintNotFoundError } from '../../../domain/fingerprint-not-found.error';
import { IncompatibleMinutiaTypesError } from '../../../domain/minutia-pair/errors/incompatible-minutia-types.error';
import { MinutiaOutsidePieceError } from '../../../domain/minutia-pair/errors/minutia-outside-piece.error';
import { MinutiaPairAlreadyExistsError } from '../../../domain/minutia-pair/errors/minutia-pair-already-exists.error';
import { NotAMinutiaLayerError } from '../../../domain/minutia-pair/errors/not-a-minutia-layer.error';
import { PiecesNotInSameCaseError } from '../../../domain/minutia-pair/errors/pieces-not-in-same-case.error';
import { InMemoryCaseStatusAdapter } from '../../../infrastructure/persistence/in-memory-case-status.adapter';
import { InMemoryFingerprintLocatorAdapter } from '../../../infrastructure/persistence/in-memory-fingerprint-locator.adapter';
import { InMemoryLayerRepository } from '../../../infrastructure/persistence/in-memory-layer.repository';
import { InMemoryMinutiaPairRepository } from '../../../infrastructure/persistence/in-memory-minutia-pair.repository';
import { CreateMinutiaPairCommand } from './create-minutia-pair.command';
import { CreateMinutiaPairHandler } from './create-minutia-pair.handler';

describe('CreateMinutiaPairHandler', () => {
  const minutiaSettings = (
    minutiaType: MinutiaTypeEnum,
    x: number,
    y: number,
  ): LayerSettings => ({
    type: 'minutia',
    x,
    y,
    radius: 6,
    color: '#ef4444',
    angle: 90,
    minutiaType,
  });

  let handler: CreateMinutiaPairHandler;
  let auditTrail: InMemoryAuditTrailAppender;
  let layers: InMemoryLayerRepository;
  let pairs: InMemoryMinutiaPairRepository;
  let locator: InMemoryFingerprintLocatorAdapter;
  let caseStatus: InMemoryCaseStatusAdapter;
  let transactionRunner: InMemoryTransactionRunner;
  let generatedIds: string[];

  const seedMinutia = (
    id: string,
    fingerprintId: string,
    settings: LayerSettings,
    createdByUserId: string | null = 'user-marie',
  ) =>
    layers.seed(
      Layer.create({
        id,
        fingerprintId,
        name: 'Minutie',
        type: 'ANNOTATION',
        zIndex: 0,
        settings,
        createdByUserId,
      }),
    );

  const command = (
    overrides: Partial<{
      traceMinutiaLayerId: string;
      referenceMinutiaLayerId: string;
      referencePrintId: string;
      traceId: string;
      blindVerifierUserId: string | null;
    }> = {},
  ) =>
    new CreateMinutiaPairCommand(
      EXPERT_ACTOR,
      overrides.traceId ?? 'trace-1',
      overrides.referencePrintId ?? 'ref-1',
      overrides.traceMinutiaLayerId ?? 'layer-trace-1',
      overrides.referenceMinutiaLayerId ?? 'layer-ref-1',
      'user-marie',
      overrides.blindVerifierUserId ?? null,
    );

  beforeEach(() => {
    generatedIds = ['pair-1', 'pair-2', 'pair-3'];
    auditTrail = new InMemoryAuditTrailAppender();
    layers = new InMemoryLayerRepository(auditTrail);
    pairs = new InMemoryMinutiaPairRepository(layers, auditTrail);
    locator = new InMemoryFingerprintLocatorAdapter();
    caseStatus = new InMemoryCaseStatusAdapter();
    transactionRunner = new InMemoryTransactionRunner();
    handler = new CreateMinutiaPairHandler(
      layers,
      pairs,
      pairs,
      locator,
      caseStatus,
      { generate: () => generatedIds.shift() ?? 'exhausted' },
      transactionRunner,
    );

    locator.setTrace('trace-1', 'case-9');
    locator.setReferencePrint('ref-1', 'case-9');
    caseStatus.set('case-9', 'OPEN');
    seedMinutia(
      'layer-trace-1',
      'trace-1',
      minutiaSettings(MinutiaTypeEnum.BIFURCATION, 120, 240),
    );
    seedMinutia(
      'layer-ref-1',
      'ref-1',
      minutiaSettings(MinutiaTypeEnum.BIFURCATION, 310, 118),
    );
  });

  it('pairs two minutiae of the same type and gives back the pair numbered one', async () => {
    const created = await handler.execute(command());

    expect(created).toEqual({
      id: 'pair-1',
      number: 1,
      traceMinutiaLayerId: 'layer-trace-1',
      referenceMinutiaLayerId: 'layer-ref-1',
      minutiaType: MinutiaTypeEnum.BIFURCATION,
    });
    expect(pairs.store.size).toBe(1);
  });

  it('numbers the next pair of the same comparison two', async () => {
    seedMinutia(
      'layer-trace-2',
      'trace-1',
      minutiaSettings(MinutiaTypeEnum.ISLAND, 20, 30),
    );
    seedMinutia(
      'layer-ref-2',
      'ref-1',
      minutiaSettings(MinutiaTypeEnum.ISLAND, 40, 50),
    );
    await handler.execute(command());

    const second = await handler.execute(
      command({
        traceMinutiaLayerId: 'layer-trace-2',
        referenceMinutiaLayerId: 'layer-ref-2',
      }),
    );

    expect(second.number).toBe(2);
  });

  it('chains a MINUTIA_PAIRED carrying both marks with their values', async () => {
    await handler.execute(command());

    expect(auditTrail.events).toHaveLength(1);
    const [event] = auditTrail.events;
    expect(event.eventType).toBe(AuditEventTypeEnum.MINUTIA_PAIRED);
    expect(event.evidenceClass).toBe(EvidenceClassEnum.OBSERVED);
    expect(event.actor).toEqual(EXPERT_ACTOR.toPrimitives());
    expect(event.caseId).toBe('case-9');
    expect(event.traceId).toBe('trace-1');
    expect(event.payload).toEqual({
      pairId: 'pair-1',
      traceId: 'trace-1',
      referencePrintId: 'ref-1',
      traceMinutiaLayerId: 'layer-trace-1',
      referenceMinutiaLayerId: 'layer-ref-1',
      traceMinutia: {
        x: 120,
        y: 240,
        minutiaType: MinutiaTypeEnum.BIFURCATION,
      },
      referenceMinutia: {
        x: 310,
        y: 118,
        minutiaType: MinutiaTypeEnum.BIFURCATION,
      },
    });
  });

  it('writes the pair and its act inside one transaction', async () => {
    await handler.execute(command());

    expect(transactionRunner.runCount).toBe(1);
  });

  it('qualifies the undetermined reference side and journals both values', async () => {
    layers.seed(
      Layer.create({
        id: 'layer-ref-1',
        fingerprintId: 'ref-1',
        name: 'Minutie',
        type: 'ANNOTATION',
        zIndex: 0,
        settings: minutiaSettings(MinutiaTypeEnum.UNDETERMINED, 310, 118),
        createdByUserId: 'user-marie',
      }),
    );

    const created = await handler.execute(command());

    const qualified = await layers.findById('layer-ref-1');
    expect(qualified?.toPrimitives().settings.minutiaType).toBe(
      MinutiaTypeEnum.BIFURCATION,
    );
    expect(created.minutiaType).toBe(MinutiaTypeEnum.BIFURCATION);
    const [requalification] = auditTrail.events;
    expect(requalification.eventType).toBe(AuditEventTypeEnum.LAYER_UPDATED);
    expect(requalification.payload).toMatchObject({
      layerId: 'layer-ref-1',
      previousMinutiaType: MinutiaTypeEnum.UNDETERMINED,
    });
    expect(
      (requalification.payload.settings as LayerSettings).minutiaType,
    ).toBe(MinutiaTypeEnum.BIFURCATION);
    expect(auditTrail.events.map((event) => event.eventType)).toEqual([
      AuditEventTypeEnum.LAYER_UPDATED,
      AuditEventTypeEnum.MINUTIA_PAIRED,
    ]);
  });

  it('qualifies the undetermined trace side', async () => {
    layers.seed(
      Layer.create({
        id: 'layer-trace-1',
        fingerprintId: 'trace-1',
        name: 'Minutie',
        type: 'ANNOTATION',
        zIndex: 0,
        settings: minutiaSettings(MinutiaTypeEnum.UNDETERMINED, 120, 240),
        createdByUserId: 'user-marie',
      }),
    );

    await handler.execute(command());

    const qualified = await layers.findById('layer-trace-1');
    expect(qualified?.toPrimitives().settings.minutiaType).toBe(
      MinutiaTypeEnum.BIFURCATION,
    );
  });

  it('pairs two undetermined minutiae without qualifying either side', async () => {
    for (const [id, fingerprintId] of [
      ['layer-trace-1', 'trace-1'],
      ['layer-ref-1', 'ref-1'],
    ]) {
      layers.seed(
        Layer.create({
          id,
          fingerprintId,
          name: 'Minutie',
          type: 'ANNOTATION',
          zIndex: 0,
          settings: minutiaSettings(MinutiaTypeEnum.UNDETERMINED, 1, 2),
          createdByUserId: 'user-marie',
        }),
      );
    }

    const created = await handler.execute(command());

    expect(created.minutiaType).toBe(MinutiaTypeEnum.UNDETERMINED);
    expect(auditTrail.events.map((event) => event.eventType)).toEqual([
      AuditEventTypeEnum.MINUTIA_PAIRED,
    ]);
  });

  it('refuses two different determined types and pairs nothing', async () => {
    layers.seed(
      Layer.create({
        id: 'layer-ref-1',
        fingerprintId: 'ref-1',
        name: 'Minutie',
        type: 'ANNOTATION',
        zIndex: 0,
        settings: minutiaSettings(MinutiaTypeEnum.TRIFURCATION, 310, 118),
        createdByUserId: 'user-marie',
      }),
    );

    await expect(handler.execute(command())).rejects.toBeInstanceOf(
      IncompatibleMinutiaTypesError,
    );
    expect(pairs.store.size).toBe(0);
    expect(auditTrail.events).toEqual([]);
  });

  it('refuses a trace minutia that does not exist', async () => {
    await expect(
      handler.execute(command({ traceMinutiaLayerId: 'missing' })),
    ).rejects.toBeInstanceOf(LayerNotFoundError);
    expect(pairs.store.size).toBe(0);
    expect(auditTrail.events).toEqual([]);
  });

  it('refuses a reference minutia that does not exist', async () => {
    await expect(
      handler.execute(command({ referenceMinutiaLayerId: 'missing' })),
    ).rejects.toBeInstanceOf(LayerNotFoundError);
    expect(pairs.store.size).toBe(0);
  });

  it('refuses a layer that is not a minutia', async () => {
    seedMinutia('layer-trace-1', 'trace-1', {
      type: 'pencil',
      points: [1, 2, 3, 4],
      color: '#000000',
      strokeWidth: 2,
    });

    await expect(handler.execute(command())).rejects.toBeInstanceOf(
      NotAMinutiaLayerError,
    );
    expect(pairs.store.size).toBe(0);
    expect(auditTrail.events).toEqual([]);
  });

  it('refuses a trace minutia posed on another piece', async () => {
    seedMinutia(
      'layer-trace-1',
      'other-piece',
      minutiaSettings(MinutiaTypeEnum.BIFURCATION, 1, 2),
    );

    await expect(handler.execute(command())).rejects.toBeInstanceOf(
      MinutiaOutsidePieceError,
    );
    expect(pairs.store.size).toBe(0);
  });

  it('refuses a reference minutia posed on another piece', async () => {
    seedMinutia(
      'layer-ref-1',
      'other-piece',
      minutiaSettings(MinutiaTypeEnum.BIFURCATION, 1, 2),
    );

    await expect(handler.execute(command())).rejects.toBeInstanceOf(
      MinutiaOutsidePieceError,
    );
    expect(pairs.store.size).toBe(0);
  });

  it('refuses a trace the locator does not know', async () => {
    await expect(
      handler.execute(command({ traceId: 'unknown-trace' })),
    ).rejects.toBeInstanceOf(FingerprintNotFoundError);
    expect(pairs.store.size).toBe(0);
  });

  it('refuses a reference print of another case', async () => {
    locator.setReferencePrint('ref-1', 'case-other');

    await expect(handler.execute(command())).rejects.toBeInstanceOf(
      PiecesNotInSameCaseError,
    );
    expect(pairs.store.size).toBe(0);
    expect(auditTrail.events).toEqual([]);
  });

  it('refuses to pair anything on a closed case', async () => {
    caseStatus.set('case-9', 'CLOSED');

    await expect(handler.execute(command())).rejects.toBeInstanceOf(
      CaseNotOpenForWorkError,
    );
    expect(pairs.store.size).toBe(0);
    expect(auditTrail.events).toEqual([]);
  });

  it('refuses to pair the same two minutiae twice', async () => {
    await handler.execute(command());

    await expect(handler.execute(command())).rejects.toBeInstanceOf(
      MinutiaPairAlreadyExistsError,
    );
    expect(pairs.store.size).toBe(1);
  });

  it('lets one trace minutia be paired on two different reference prints', async () => {
    locator.setReferencePrint('ref-2', 'case-9');
    seedMinutia(
      'layer-ref-2',
      'ref-2',
      minutiaSettings(MinutiaTypeEnum.BIFURCATION, 5, 6),
    );
    await handler.execute(command());

    const second = await handler.execute(
      command({
        referencePrintId: 'ref-2',
        referenceMinutiaLayerId: 'layer-ref-2',
      }),
    );

    expect(second.number).toBe(1);
    expect(pairs.store.size).toBe(2);
  });

  it('refuses a blind verifier pairing a trace minutia posed by the operator', async () => {
    seedMinutia(
      'layer-ref-1',
      'ref-1',
      minutiaSettings(MinutiaTypeEnum.BIFURCATION, 310, 118),
      'user-lucie',
    );

    await expect(
      handler.execute(command({ blindVerifierUserId: 'user-lucie' })),
    ).rejects.toBeInstanceOf(LayerNotAuthoredByVerifierError);
    expect(pairs.store.size).toBe(0);
    expect(auditTrail.events).toEqual([]);
  });

  it('refuses a blind verifier pairing a reference minutia posed by the operator', async () => {
    seedMinutia(
      'layer-trace-1',
      'trace-1',
      minutiaSettings(MinutiaTypeEnum.BIFURCATION, 120, 240),
      'user-lucie',
    );

    await expect(
      handler.execute(command({ blindVerifierUserId: 'user-lucie' })),
    ).rejects.toBeInstanceOf(LayerNotAuthoredByVerifierError);
    expect(pairs.store.size).toBe(0);
    expect(auditTrail.events).toEqual([]);
  });

  it('never requalifies a minutia the blind verifier does not own', async () => {
    seedMinutia(
      'layer-trace-1',
      'trace-1',
      minutiaSettings(MinutiaTypeEnum.UNDETERMINED, 120, 240),
    );
    seedMinutia(
      'layer-ref-1',
      'ref-1',
      minutiaSettings(MinutiaTypeEnum.BIFURCATION, 310, 118),
      'user-lucie',
    );

    await expect(
      handler.execute(command({ blindVerifierUserId: 'user-lucie' })),
    ).rejects.toBeInstanceOf(LayerNotAuthoredByVerifierError);
    const untouched = await layers.findById('layer-trace-1');
    expect(untouched?.toPrimitives().settings.minutiaType).toBe(
      MinutiaTypeEnum.UNDETERMINED,
    );
  });

  it('numbers the created pair among the blind verifier’s own pairs only', async () => {
    seedMinutia(
      'layer-trace-2',
      'trace-1',
      minutiaSettings(MinutiaTypeEnum.ISLAND, 20, 30),
      'user-lucie',
    );
    seedMinutia(
      'layer-ref-2',
      'ref-1',
      minutiaSettings(MinutiaTypeEnum.ISLAND, 40, 50),
      'user-lucie',
    );
    await handler.execute(command());

    const verifierPair = await handler.execute(
      command({
        traceMinutiaLayerId: 'layer-trace-2',
        referenceMinutiaLayerId: 'layer-ref-2',
        blindVerifierUserId: 'user-lucie',
      }),
    );

    expect(verifierPair.number).toBe(1);
  });
});
