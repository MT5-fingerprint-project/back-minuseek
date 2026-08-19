import { EXPERT_ACTOR } from '../../../../shared/domain/audit/audit-actor.fixture';
import { AuditEventTypeEnum } from '../../../../shared/domain/audit/audit-event-type.vo';
import { EvidenceClassEnum } from '../../../../shared/domain/audit/evidence-class.vo';
import { InMemoryAuditTrailAppender } from '../../../../audit-trail/infrastructure/persistence/in-memory-audit-trail.appender';
import { InMemoryTransactionRunner } from '../../../../tenancy/infrastructure/persistence/in-memory-transaction-runner';
import { FingerprintNotFoundError } from '../../../domain/fingerprint-not-found.error';
import { InMemoryFingerprintLocatorAdapter } from '../../../infrastructure/persistence/in-memory-fingerprint-locator.adapter';
import { InMemoryLayerRepository } from '../../../infrastructure/persistence/in-memory-layer.repository';
import { CreateLayerCommand } from './create-layer.command';
import { CreateLayerHandler } from './create-layer.handler';

describe('CreateLayerHandler', () => {
  const settings = {
    type: 'circle',
    x: 10,
    y: 20,
    radius: 4,
    color: '#ef4444',
  };

  let handler: CreateLayerHandler;
  let repo: InMemoryLayerRepository;
  let fingerprintLocator: InMemoryFingerprintLocatorAdapter;
  let transactionRunner: InMemoryTransactionRunner;
  let auditTrail: InMemoryAuditTrailAppender;

  const command = (fingerprintId = 'fp-1') =>
    new CreateLayerCommand(
      EXPERT_ACTOR,
      'layer-1',
      fingerprintId,
      'Point',
      'ANNOTATION',
      0,
      settings,
    );

  beforeEach(() => {
    repo = new InMemoryLayerRepository();
    fingerprintLocator = new InMemoryFingerprintLocatorAdapter();
    transactionRunner = new InMemoryTransactionRunner();
    auditTrail = new InMemoryAuditTrailAppender();
    handler = new CreateLayerHandler(
      repo,
      fingerprintLocator,
      transactionRunner,
      auditTrail,
    );
  });

  it('persiste un calque ANNOTATION visible par défaut en conservant ses settings', async () => {
    fingerprintLocator.setTrace('fp-1', 'case-9');

    await handler.execute(command());

    const saved = await repo.findById('layer-1');
    expect(saved).not.toBeNull();
    expect(saved?.toPrimitives()).toEqual({
      id: 'layer-1',
      fingerprintId: 'fp-1',
      name: 'Point',
      type: 'ANNOTATION',
      zIndex: 0,
      isVisible: true,
      settings,
    });
  });

  it('chaîne un LAYER_CREATED avec le snapshot complet du calque', async () => {
    fingerprintLocator.setTrace('fp-1', 'case-9');

    await handler.execute(command());

    expect(auditTrail.events).toHaveLength(1);
    const [event] = auditTrail.events;
    expect(event.eventType).toBe(AuditEventTypeEnum.LAYER_CREATED);
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

  it('rattache au dossier sans traceId quand le calque porte sur une empreinte de référence', async () => {
    fingerprintLocator.setReferencePrint('fp-1', 'case-9');

    await handler.execute(command());

    const [event] = auditTrail.events;
    expect(event.caseId).toBe('case-9');
    expect(event.traceId).toBeNull();
  });

  it('écrit le calque et son maillon dans une seule transaction', async () => {
    fingerprintLocator.setTrace('fp-1', 'case-9');

    await handler.execute(command());

    expect(transactionRunner.runCount).toBe(1);
  });

  it('refuse un calque posé sur une pièce inexistante', async () => {
    await expect(
      handler.execute(command('fp-inconnue')),
    ).rejects.toBeInstanceOf(FingerprintNotFoundError);
    expect(await repo.findById('layer-1')).toBeNull();
    expect(auditTrail.events).toHaveLength(0);
  });
});
