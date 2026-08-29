import { EXPERT_ACTOR } from '../../../../shared/domain/audit/audit-actor.fixture';
import { AuditEventTypeEnum } from '../../../../shared/domain/audit/audit-event-type.vo';
import { EvidenceClassEnum } from '../../../../shared/domain/audit/evidence-class.vo';
import { InMemoryAuditTrailAppender } from '../../../../audit-trail/infrastructure/persistence/in-memory-audit-trail.appender';
import { FingerprintNotFoundError } from '../../../domain/fingerprint-not-found.error';
import { ExpertAdjustmentOutsideExpertiseError } from '../../../domain/errors/expert-adjustment-outside-expertise.error';
import { InMemoryCaseExpertiseAdapter } from '../../../infrastructure/persistence/in-memory-case-expertise.adapter';
import { InMemoryCaseStatusAdapter } from '../../../infrastructure/persistence/in-memory-case-status.adapter';
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
  let caseStatus: InMemoryCaseStatusAdapter;
  let caseExpertise: InMemoryCaseExpertiseAdapter;
  let repo: InMemoryLayerRepository;
  let fingerprintLocator: InMemoryFingerprintLocatorAdapter;
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
    auditTrail = new InMemoryAuditTrailAppender();
    repo = new InMemoryLayerRepository(auditTrail);
    fingerprintLocator = new InMemoryFingerprintLocatorAdapter();
    caseStatus = new InMemoryCaseStatusAdapter();
    caseStatus.set('case-9', 'OPEN');
    caseExpertise = new InMemoryCaseExpertiseAdapter();
    handler = new CreateLayerHandler(
      repo,
      fingerprintLocator,
      caseStatus,
      caseExpertise,
    );
  });

  it("refuse un réglage d'expert sur un dossier qui n'est pas en expertise", async () => {
    fingerprintLocator.setTrace('fp-1', 'case-9');

    await expect(
      handler.execute(
        new CreateLayerCommand(
          EXPERT_ACTOR,
          'layer-expert',
          'fp-1',
          'Point noir',
          'FILTER',
          0,
          { filterKey: 'levelsBlack', value: 30 },
        ),
      ),
    ).rejects.toThrow(ExpertAdjustmentOutsideExpertiseError);
    expect(await repo.findById('layer-expert')).toBeNull();
    expect(auditTrail.events).toEqual([]);
  });

  it('accepte le même réglage sur un dossier déclaré en expertise', async () => {
    fingerprintLocator.setTrace('fp-1', 'case-9');
    caseExpertise.declare('case-9');

    await handler.execute(
      new CreateLayerCommand(
        EXPERT_ACTOR,
        'layer-expert',
        'fp-1',
        'Point noir',
        'FILTER',
        0,
        { filterKey: 'levelsBlack', value: 30 },
      ),
    );

    expect(await repo.findById('layer-expert')).not.toBeNull();
    expect(auditTrail.events).toHaveLength(1);
  });

  it('laisse créer un des six réglages ordinaires hors expertise', async () => {
    fingerprintLocator.setTrace('fp-1', 'case-9');

    await handler.execute(
      new CreateLayerCommand(
        EXPERT_ACTOR,
        'layer-contraste',
        'fp-1',
        'Contraste',
        'FILTER',
        0,
        { filterKey: 'contrast', value: 30 },
      ),
    );

    expect(await repo.findById('layer-contraste')).not.toBeNull();
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

  it('refuse un calque posé sur une pièce inexistante', async () => {
    await expect(
      handler.execute(command('fp-inconnue')),
    ).rejects.toBeInstanceOf(FingerprintNotFoundError);
    expect(await repo.findById('layer-1')).toBeNull();
    expect(auditTrail.events).toHaveLength(0);
  });
});
