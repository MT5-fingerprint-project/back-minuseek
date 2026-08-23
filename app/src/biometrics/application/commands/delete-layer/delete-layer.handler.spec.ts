import { EXPERT_ACTOR } from '../../../../shared/domain/audit/audit-actor.fixture';
import { AuditEventTypeEnum } from '../../../../shared/domain/audit/audit-event-type.vo';
import { EvidenceClassEnum } from '../../../../shared/domain/audit/evidence-class.vo';
import { InMemoryAuditTrailAppender } from '../../../../audit-trail/infrastructure/persistence/in-memory-audit-trail.appender';
import { Layer } from '../../../domain/layer/entity/layer';
import { LayerNotFoundError } from '../../../domain/layer/errors/layer-not-found.error';
import { InMemoryFingerprintLocatorAdapter } from '../../../infrastructure/persistence/in-memory-fingerprint-locator.adapter';
import { InMemoryLayerRepository } from '../../../infrastructure/persistence/in-memory-layer.repository';
import { DeleteLayerCommand } from './delete-layer.command';
import { DeleteLayerHandler } from './delete-layer.handler';

describe('DeleteLayerHandler', () => {
  const settings = {
    type: 'circle',
    x: 10,
    y: 20,
    radius: 4,
    color: '#ef4444',
  };

  let handler: DeleteLayerHandler;
  let repo: InMemoryLayerRepository;
  let fingerprintLocator: InMemoryFingerprintLocatorAdapter;
  let auditTrail: InMemoryAuditTrailAppender;

  const existingLayer = () =>
    repo.seed(
      Layer.create({
        id: 'layer-1',
        fingerprintId: 'fp-1',
        name: 'Point',
        type: 'ANNOTATION',
        zIndex: 0,
        settings,
      }),
    );

  beforeEach(() => {
    auditTrail = new InMemoryAuditTrailAppender();
    repo = new InMemoryLayerRepository(auditTrail);
    fingerprintLocator = new InMemoryFingerprintLocatorAdapter();
    handler = new DeleteLayerHandler(repo, fingerprintLocator);
    fingerprintLocator.setTrace('fp-1', 'case-9');
  });

  it('supprime un calque existant', async () => {
    existingLayer();

    await handler.execute(new DeleteLayerCommand(EXPERT_ACTOR, 'layer-1'));

    expect(await repo.findById('layer-1')).toBeNull();
  });

  it('chaîne un LAYER_DELETED qui conserve le calque disparu de la table', async () => {
    existingLayer();

    await handler.execute(new DeleteLayerCommand(EXPERT_ACTOR, 'layer-1'));

    expect(auditTrail.events).toHaveLength(1);
    const [event] = auditTrail.events;
    expect(event.eventType).toBe(AuditEventTypeEnum.LAYER_DELETED);
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
      isVisible: true,
      settings,
    });
  });

  it('lève LayerNotFoundError si le calque est introuvable', async () => {
    await expect(
      handler.execute(new DeleteLayerCommand(EXPERT_ACTOR, 'missing')),
    ).rejects.toBeInstanceOf(LayerNotFoundError);
    expect(auditTrail.events).toHaveLength(0);
  });
});
