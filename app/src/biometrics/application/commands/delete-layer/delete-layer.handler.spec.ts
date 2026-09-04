import { EXPERT_ACTOR } from '../../../../shared/domain/audit/audit-actor.fixture';
import { AuditEventTypeEnum } from '../../../../shared/domain/audit/audit-event-type.vo';
import { EvidenceClassEnum } from '../../../../shared/domain/audit/evidence-class.vo';
import { InMemoryAuditTrailAppender } from '../../../../audit-trail/infrastructure/persistence/in-memory-audit-trail.appender';
import { Layer } from '../../../domain/layer/entity/layer';
import { LayerNotFoundError } from '../../../domain/layer/errors/layer-not-found.error';
import { InMemoryCaseStatusAdapter } from '../../../infrastructure/persistence/in-memory-case-status.adapter';
import { InMemoryFingerprintLocatorAdapter } from '../../../infrastructure/persistence/in-memory-fingerprint-locator.adapter';
import { InMemoryLayerRepository } from '../../../infrastructure/persistence/in-memory-layer.repository';
import { DeleteLayerCommand } from './delete-layer.command';
import { DeleteLayerHandler } from './delete-layer.handler';
import { LayerNotAuthoredByVerifierError } from '../../../domain/layer/errors/layer-not-authored-by-verifier.error';
import { MinutiaPair } from '../../../domain/minutia-pair/entity/minutia-pair';
import { InMemoryMinutiaPairRepository } from '../../../infrastructure/persistence/in-memory-minutia-pair.repository';

describe('DeleteLayerHandler', () => {
  const settings = {
    type: 'circle',
    x: 10,
    y: 20,
    radius: 4,
    color: '#ef4444',
  };

  let handler: DeleteLayerHandler;
  let caseStatus: InMemoryCaseStatusAdapter;
  let repo: InMemoryLayerRepository;
  let pairs: InMemoryMinutiaPairRepository;
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
        createdByUserId: 'user-marie',
      }),
    );

  const pairedWith = (
    pairId: string,
    referencePrintId: string,
    referenceMinutiaLayerId: string,
  ) => {
    repo.seed(
      Layer.create({
        id: referenceMinutiaLayerId,
        fingerprintId: referencePrintId,
        name: 'Minutie',
        type: 'ANNOTATION',
        zIndex: 0,
        settings: { ...settings, x: 310, y: 118 },
        createdByUserId: 'user-marie',
      }),
    );
    pairs.seed(
      MinutiaPair.fromPrimitives({
        id: pairId,
        traceId: 'fp-1',
        referencePrintId,
        traceMinutiaLayerId: 'layer-1',
        referenceMinutiaLayerId,
        createdByUserId: 'user-marie',
        createdAt: new Date('2026-09-01T10:00:00Z'),
      }),
    );
  };

  beforeEach(() => {
    auditTrail = new InMemoryAuditTrailAppender();
    repo = new InMemoryLayerRepository(auditTrail);
    pairs = new InMemoryMinutiaPairRepository(repo, auditTrail);
    fingerprintLocator = new InMemoryFingerprintLocatorAdapter();
    caseStatus = new InMemoryCaseStatusAdapter();
    caseStatus.set('case-9', 'OPEN');
    handler = new DeleteLayerHandler(
      repo,
      pairs,
      fingerprintLocator,
      caseStatus,
    );
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
      createdByUserId: 'user-marie',
    });
  });

  it('lève LayerNotFoundError si le calque est introuvable', async () => {
    await expect(
      handler.execute(new DeleteLayerCommand(EXPERT_ACTOR, 'missing')),
    ).rejects.toBeInstanceOf(LayerNotFoundError);
    expect(auditTrail.events).toHaveLength(0);
  });

  it('journalise le dépariement causé par la suppression, en plus du retrait', async () => {
    existingLayer();
    pairedWith('pair-1', 'ref-1', 'layer-ref-1');

    await handler.execute(new DeleteLayerCommand(EXPERT_ACTOR, 'layer-1'));

    expect(auditTrail.events.map((event) => event.eventType)).toEqual([
      AuditEventTypeEnum.LAYER_DELETED,
      AuditEventTypeEnum.MINUTIA_UNPAIRED,
    ]);
    const unpairing = auditTrail.events[1];
    expect(unpairing.caseId).toBe('case-9');
    expect(unpairing.traceId).toBe('fp-1');
    expect(unpairing.payload).toEqual({
      pairId: 'pair-1',
      traceId: 'fp-1',
      referencePrintId: 'ref-1',
      traceMinutiaLayerId: 'layer-1',
      referenceMinutiaLayerId: 'layer-ref-1',
      traceMinutia: { x: 10, y: 20, minutiaType: 'UNDETERMINED' },
      referenceMinutia: { x: 310, y: 118, minutiaType: 'UNDETERMINED' },
      cause: 'MINUTIA_DELETED',
    });
  });

  it('journalise un dépariement par paire citant le calque supprimé', async () => {
    existingLayer();
    pairedWith('pair-1', 'ref-1', 'layer-ref-1');
    pairedWith('pair-2', 'ref-2', 'layer-ref-2');

    await handler.execute(new DeleteLayerCommand(EXPERT_ACTOR, 'layer-1'));

    expect(
      auditTrail.events
        .filter(
          (event) => event.eventType === AuditEventTypeEnum.MINUTIA_UNPAIRED,
        )
        .map((event) => event.payload.pairId),
    ).toEqual(['pair-1', 'pair-2']);
  });

  it('laisse la base emporter les paires du calque supprimé', async () => {
    existingLayer();
    pairedWith('pair-1', 'ref-1', 'layer-ref-1');

    await handler.execute(new DeleteLayerCommand(EXPERT_ACTOR, 'layer-1'));

    expect(await pairs.findById('pair-1')).toBeNull();
  });

  it("refuse au vérificateur de supprimer un calque qui n'est pas le sien", async () => {
    existingLayer();

    await expect(
      handler.execute(
        new DeleteLayerCommand(EXPERT_ACTOR, 'layer-1', 'user-lucie'),
      ),
    ).rejects.toBeInstanceOf(LayerNotAuthoredByVerifierError);
    expect(await repo.findById('layer-1')).not.toBeNull();
    expect(auditTrail.events).toEqual([]);
  });
});
