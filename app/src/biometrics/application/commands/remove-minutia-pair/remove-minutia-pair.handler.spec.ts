import { EXPERT_ACTOR } from '../../../../shared/domain/audit/audit-actor.fixture';
import { AuditEventTypeEnum } from '../../../../shared/domain/audit/audit-event-type.vo';
import { EvidenceClassEnum } from '../../../../shared/domain/audit/evidence-class.vo';
import { MinutiaTypeEnum } from '../../../../shared/domain/forensics/minutiae';
import { InMemoryAuditTrailAppender } from '../../../../audit-trail/infrastructure/persistence/in-memory-audit-trail.appender';
import { Layer, type LayerSettings } from '../../../domain/layer/entity/layer';
import { CaseNotOpenForWorkError } from '../../../domain/errors/case-not-open-for-work.error';
import { FingerprintNotFoundError } from '../../../domain/fingerprint-not-found.error';
import { MinutiaPair } from '../../../domain/minutia-pair/entity/minutia-pair';
import { MinutiaPairNotAuthoredByVerifierError } from '../../../domain/minutia-pair/errors/minutia-pair-not-authored-by-verifier.error';
import { MinutiaPairNotFoundError } from '../../../domain/minutia-pair/errors/minutia-pair-not-found.error';
import { InMemoryCaseStatusAdapter } from '../../../infrastructure/persistence/in-memory-case-status.adapter';
import { InMemoryFingerprintLocatorAdapter } from '../../../infrastructure/persistence/in-memory-fingerprint-locator.adapter';
import { InMemoryLayerRepository } from '../../../infrastructure/persistence/in-memory-layer.repository';
import { InMemoryMinutiaPairRepository } from '../../../infrastructure/persistence/in-memory-minutia-pair.repository';
import { RemoveMinutiaPairCommand } from './remove-minutia-pair.command';
import { RemoveMinutiaPairHandler } from './remove-minutia-pair.handler';

describe('RemoveMinutiaPairHandler', () => {
  const minutiaSettings = (x: number, y: number): LayerSettings => ({
    type: 'minutia',
    x,
    y,
    radius: 6,
    color: '#ef4444',
    angle: 90,
    minutiaType: MinutiaTypeEnum.BIFURCATION,
  });

  let handler: RemoveMinutiaPairHandler;
  let auditTrail: InMemoryAuditTrailAppender;
  let layers: InMemoryLayerRepository;
  let pairs: InMemoryMinutiaPairRepository;
  let locator: InMemoryFingerprintLocatorAdapter;
  let caseStatus: InMemoryCaseStatusAdapter;

  beforeEach(() => {
    auditTrail = new InMemoryAuditTrailAppender();
    layers = new InMemoryLayerRepository(auditTrail);
    pairs = new InMemoryMinutiaPairRepository(layers, auditTrail);
    locator = new InMemoryFingerprintLocatorAdapter();
    caseStatus = new InMemoryCaseStatusAdapter();
    handler = new RemoveMinutiaPairHandler(layers, pairs, locator, caseStatus);

    locator.setTrace('trace-1', 'case-9');
    caseStatus.set('case-9', 'OPEN');
    for (const [id, fingerprintId, x, y] of [
      ['layer-trace-1', 'trace-1', 120, 240],
      ['layer-ref-1', 'ref-1', 310, 118],
    ] as const) {
      layers.seed(
        Layer.create({
          id,
          fingerprintId,
          name: 'Minutie',
          type: 'ANNOTATION',
          zIndex: 0,
          settings: minutiaSettings(x, y),
          createdByUserId: 'user-marie',
        }),
      );
    }
    pairs.seed(
      MinutiaPair.fromPrimitives({
        id: 'pair-1',
        traceId: 'trace-1',
        referencePrintId: 'ref-1',
        traceMinutiaLayerId: 'layer-trace-1',
        referenceMinutiaLayerId: 'layer-ref-1',
        createdByUserId: 'user-marie',
        createdAt: new Date('2026-09-01T10:00:00Z'),
      }),
    );
  });

  it('removes the pair from the case file', async () => {
    await handler.execute(
      new RemoveMinutiaPairCommand(EXPERT_ACTOR, 'trace-1', 'pair-1'),
    );

    expect(await pairs.findById('pair-1')).toBeNull();
  });

  it('chains a MINUTIA_UNPAIRED naming the operator as the cause', async () => {
    await handler.execute(
      new RemoveMinutiaPairCommand(EXPERT_ACTOR, 'trace-1', 'pair-1'),
    );

    expect(auditTrail.events).toHaveLength(1);
    const [event] = auditTrail.events;
    expect(event.eventType).toBe(AuditEventTypeEnum.MINUTIA_UNPAIRED);
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
      cause: 'OPERATOR',
    });
  });

  it('refuses a pair that does not exist', async () => {
    await expect(
      handler.execute(
        new RemoveMinutiaPairCommand(EXPERT_ACTOR, 'trace-1', 'missing'),
      ),
    ).rejects.toBeInstanceOf(MinutiaPairNotFoundError);
    expect(auditTrail.events).toEqual([]);
  });

  it('refuses a pair that belongs to another trace', async () => {
    locator.setTrace('trace-2', 'case-9');

    await expect(
      handler.execute(
        new RemoveMinutiaPairCommand(EXPERT_ACTOR, 'trace-2', 'pair-1'),
      ),
    ).rejects.toBeInstanceOf(MinutiaPairNotFoundError);
    expect(await pairs.findById('pair-1')).not.toBeNull();
    expect(auditTrail.events).toEqual([]);
  });

  it('refuses the verifier a pair that is not his', async () => {
    await expect(
      handler.execute(
        new RemoveMinutiaPairCommand(
          EXPERT_ACTOR,
          'trace-1',
          'pair-1',
          'user-lucie',
        ),
      ),
    ).rejects.toBeInstanceOf(MinutiaPairNotAuthoredByVerifierError);
    expect(await pairs.findById('pair-1')).not.toBeNull();
    expect(auditTrail.events).toEqual([]);
  });

  it('lets the verifier remove his own pair', async () => {
    await handler.execute(
      new RemoveMinutiaPairCommand(
        EXPERT_ACTOR,
        'trace-1',
        'pair-1',
        'user-marie',
      ),
    );

    expect(await pairs.findById('pair-1')).toBeNull();
  });

  it('refuses a trace the locator does not know', async () => {
    pairs.seed(
      MinutiaPair.fromPrimitives({
        id: 'pair-2',
        traceId: 'unknown-trace',
        referencePrintId: 'ref-1',
        traceMinutiaLayerId: 'layer-trace-1',
        referenceMinutiaLayerId: 'layer-ref-1',
        createdByUserId: 'user-marie',
        createdAt: new Date('2026-09-01T11:00:00Z'),
      }),
    );

    await expect(
      handler.execute(
        new RemoveMinutiaPairCommand(EXPERT_ACTOR, 'unknown-trace', 'pair-2'),
      ),
    ).rejects.toBeInstanceOf(FingerprintNotFoundError);
    expect(auditTrail.events).toEqual([]);
  });

  it('refuses to touch a closed case', async () => {
    caseStatus.set('case-9', 'CLOSED');

    await expect(
      handler.execute(
        new RemoveMinutiaPairCommand(EXPERT_ACTOR, 'trace-1', 'pair-1'),
      ),
    ).rejects.toBeInstanceOf(CaseNotOpenForWorkError);
    expect(await pairs.findById('pair-1')).not.toBeNull();
    expect(auditTrail.events).toEqual([]);
  });

  it('refuses a second removal of the same pair', async () => {
    await handler.execute(
      new RemoveMinutiaPairCommand(EXPERT_ACTOR, 'trace-1', 'pair-1'),
    );

    await expect(
      handler.execute(
        new RemoveMinutiaPairCommand(EXPERT_ACTOR, 'trace-1', 'pair-1'),
      ),
    ).rejects.toBeInstanceOf(MinutiaPairNotFoundError);
    expect(auditTrail.events).toHaveLength(1);
  });

  it('still journals the pair when one of its minutiae is already gone', async () => {
    layers.store.delete('layer-ref-1');

    await handler.execute(
      new RemoveMinutiaPairCommand(EXPERT_ACTOR, 'trace-1', 'pair-1'),
    );

    expect(auditTrail.events[0].payload.referenceMinutia).toBeNull();
  });
});
