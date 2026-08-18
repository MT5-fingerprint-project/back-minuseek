import { EXPERT_ACTOR } from '../../../../shared/domain/audit/audit-actor.fixture';
import { AuditEventTypeEnum } from '../../../../shared/domain/audit/audit-event-type.vo';
import { EvidenceClassEnum } from '../../../../shared/domain/audit/evidence-class.vo';
import { InMemoryAuditTrailAppender } from '../../../../audit-trail/infrastructure/persistence/in-memory-audit-trail.appender';
import { InMemoryTransactionRunner } from '../../../../tenancy/infrastructure/persistence/in-memory-transaction-runner';
import { Layer } from '../../../domain/layer/entity/layer';
import { LayerNotFoundError } from '../../../domain/layer/errors/layer-not-found.error';
import { FingerprintNotFoundError } from '../../../domain/fingerprint-not-found.error';
import { InMemoryFingerprintLocatorAdapter } from '../../../infrastructure/persistence/in-memory-fingerprint-locator.adapter';
import { InMemoryLayerRepository } from '../../../infrastructure/persistence/in-memory-layer.repository';
import { UpdateLayerCommand } from './update-layer.command';
import { UpdateLayerHandler } from './update-layer.handler';

describe('UpdateLayerHandler', () => {
  const initialSettings = {
    type: 'circle',
    x: 10,
    y: 20,
    radius: 4,
    color: '#ef4444',
  };
  const movedSettings = {
    type: 'circle',
    x: 99,
    y: 88,
    radius: 4,
    color: '#ef4444',
  };

  let handler: UpdateLayerHandler;
  let repo: InMemoryLayerRepository;
  let fingerprintLocator: InMemoryFingerprintLocatorAdapter;
  let transactionRunner: InMemoryTransactionRunner;
  let auditTrail: InMemoryAuditTrailAppender;

  const existingLayer = () =>
    repo.save(
      Layer.create({
        id: 'layer-1',
        fingerprintId: 'fp-1',
        name: 'Point',
        type: 'ANNOTATION',
        zIndex: 0,
        settings: initialSettings,
      }),
    );

  beforeEach(() => {
    repo = new InMemoryLayerRepository();
    fingerprintLocator = new InMemoryFingerprintLocatorAdapter();
    transactionRunner = new InMemoryTransactionRunner();
    auditTrail = new InMemoryAuditTrailAppender();
    handler = new UpdateLayerHandler(
      repo,
      fingerprintLocator,
      transactionRunner,
      auditTrail,
    );
    fingerprintLocator.setTrace('fp-1', 'case-9');
  });

  it('met à jour les settings (déplacement du cercle) du calque existant', async () => {
    await existingLayer();

    await handler.execute(
      new UpdateLayerCommand(
        EXPERT_ACTOR,
        'layer-1',
        undefined,
        undefined,
        undefined,
        movedSettings,
      ),
    );

    const saved = await repo.findById('layer-1');
    expect(saved?.toPrimitives().settings).toEqual(movedSettings);
  });

  it("chaîne un LAYER_UPDATED portant l'état résultant, pas le delta", async () => {
    await existingLayer();

    await handler.execute(
      new UpdateLayerCommand(
        EXPERT_ACTOR,
        'layer-1',
        undefined,
        undefined,
        false,
        movedSettings,
      ),
    );

    expect(auditTrail.events).toHaveLength(1);
    const [event] = auditTrail.events;
    expect(event.eventType).toBe(AuditEventTypeEnum.LAYER_UPDATED);
    expect(event.evidenceClass).toBe(EvidenceClassEnum.OBSERVED);
    expect(event.actor).toEqual(EXPERT_ACTOR.toPrimitives());
    expect(event.caseId).toBe('case-9');
    expect(event.traceId).toBe('fp-1');
    expect(event.payload).toEqual({
      layerId: 'layer-1',
      fingerprintId: 'fp-1',
      name: 'Point',
      type: 'ANNOTATION',
      zIndex: 0,
      isVisible: false,
      settings: movedSettings,
    });
  });

  it('écrit le calque et son maillon dans une seule transaction', async () => {
    await existingLayer();

    await handler.execute(
      new UpdateLayerCommand(EXPERT_ACTOR, 'layer-1', 'Minutie 1'),
    );

    expect(transactionRunner.runCount).toBe(1);
  });

  it('lève LayerNotFoundError si le calque est introuvable', async () => {
    await expect(
      handler.execute(new UpdateLayerCommand(EXPERT_ACTOR, 'missing', 'x')),
    ).rejects.toBeInstanceOf(LayerNotFoundError);
    expect(auditTrail.events).toHaveLength(0);
  });

  it('refuse de modifier un calque dont la pièce a disparu', async () => {
    await repo.save(
      Layer.create({
        id: 'layer-orpheline',
        fingerprintId: 'fp-supprimee',
        name: 'Point',
        type: 'ANNOTATION',
        zIndex: 0,
        settings: initialSettings,
      }),
    );

    await expect(
      handler.execute(
        new UpdateLayerCommand(EXPERT_ACTOR, 'layer-orpheline', 'Minutie 1'),
      ),
    ).rejects.toBeInstanceOf(FingerprintNotFoundError);
    expect(auditTrail.events).toHaveLength(0);
  });
});
