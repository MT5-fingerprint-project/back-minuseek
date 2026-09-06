import { EXPERT_ACTOR } from '../../../../shared/domain/audit/audit-actor.fixture';
import { AuditEventTypeEnum } from '../../../../shared/domain/audit/audit-event-type.vo';
import { EvidenceClassEnum } from '../../../../shared/domain/audit/evidence-class.vo';
import { InMemoryAuditTrailAppender } from '../../../../audit-trail/infrastructure/persistence/in-memory-audit-trail.appender';
import { Layer } from '../../../domain/layer/entity/layer';
import { LayerNotFoundError } from '../../../domain/layer/errors/layer-not-found.error';
import { FingerprintNotFoundError } from '../../../domain/fingerprint-not-found.error';
import { ExpertAdjustmentOutsideExpertiseError } from '../../../domain/errors/expert-adjustment-outside-expertise.error';
import { InMemoryCaseExpertiseAdapter } from '../../../infrastructure/persistence/in-memory-case-expertise.adapter';
import { InMemoryCaseStatusAdapter } from '../../../infrastructure/persistence/in-memory-case-status.adapter';
import { InMemoryFingerprintLocatorAdapter } from '../../../infrastructure/persistence/in-memory-fingerprint-locator.adapter';
import { InMemoryLayerRepository } from '../../../infrastructure/persistence/in-memory-layer.repository';
import { UpdateLayerCommand } from './update-layer.command';
import { UpdateLayerHandler } from './update-layer.handler';
import { LayerNotAuthoredByVerifierError } from '../../../domain/layer/errors/layer-not-authored-by-verifier.error';
import { MinutiaTypeEnum } from '../../../../shared/domain/forensics/minutiae';
import { MinutiaPair } from '../../../domain/minutia-pair/entity/minutia-pair';
import { InMemoryMinutiaPairRepository } from '../../../infrastructure/persistence/in-memory-minutia-pair.repository';
import { InMemoryTransactionRunner } from '../../../../tenancy/infrastructure/persistence/in-memory-transaction-runner';

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
  let caseStatus: InMemoryCaseStatusAdapter;
  let caseExpertise: InMemoryCaseExpertiseAdapter;
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
        settings: initialSettings,
        createdByUserId: 'user-marie',
      }),
    );

  beforeEach(() => {
    auditTrail = new InMemoryAuditTrailAppender();
    repo = new InMemoryLayerRepository(auditTrail);
    pairs = new InMemoryMinutiaPairRepository(repo, auditTrail);
    fingerprintLocator = new InMemoryFingerprintLocatorAdapter();
    caseStatus = new InMemoryCaseStatusAdapter();
    caseStatus.set('case-9', 'OPEN');
    caseExpertise = new InMemoryCaseExpertiseAdapter();
    handler = new UpdateLayerHandler(
      repo,
      pairs,
      fingerprintLocator,
      caseStatus,
      caseExpertise,
      new InMemoryTransactionRunner(),
    );
    fingerprintLocator.setTrace('fp-1', 'case-9');
    fingerprintLocator.setReferencePrint('ref-1', 'case-9');
  });

  it("refuse de basculer un calque ordinaire sur un réglage d'expert hors expertise", async () => {
    existingLayer();

    await expect(
      handler.execute(
        new UpdateLayerCommand(
          EXPERT_ACTOR,
          'layer-1',
          undefined,
          undefined,
          undefined,
          { filterKey: 'channelRed', value: 1 },
        ),
      ),
    ).rejects.toThrow(ExpertAdjustmentOutsideExpertiseError);
    const untouched = await repo.findById('layer-1');
    expect(untouched?.toPrimitives().settings).toEqual(initialSettings);
    expect(auditTrail.events).toEqual([]);
  });

  it("laisse masquer un calque d'expert déjà posé sur un dossier ordinaire", async () => {
    repo.seed(
      Layer.create({
        id: 'layer-expert',
        fingerprintId: 'fp-1',
        name: 'Point noir',
        type: 'FILTER',
        zIndex: 0,
        settings: { filterKey: 'levelsBlack', value: 30 },
        createdByUserId: 'user-marie',
      }),
    );

    await handler.execute(
      new UpdateLayerCommand(
        EXPERT_ACTOR,
        'layer-expert',
        undefined,
        undefined,
        false,
      ),
    );

    const updated = await repo.findById('layer-expert');
    expect(updated?.toPrimitives().isVisible).toBe(false);
  });

  it('accepte le même basculement sur un dossier déclaré en expertise', async () => {
    existingLayer();
    caseExpertise.declare('case-9');

    await handler.execute(
      new UpdateLayerCommand(
        EXPERT_ACTOR,
        'layer-1',
        undefined,
        undefined,
        undefined,
        { filterKey: 'channelRed', value: 1 },
      ),
    );

    const updated = await repo.findById('layer-1');
    expect(updated?.toPrimitives().settings).toEqual({
      filterKey: 'channelRed',
      value: 1,
    });
  });

  it('met à jour les settings (déplacement du cercle) du calque existant', async () => {
    existingLayer();

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
    existingLayer();

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
      createdByUserId: 'user-marie',
    });
  });

  describe('une minutie engagée dans une paire', () => {
    const minutia = (minutiaType: MinutiaTypeEnum) => ({
      type: 'minutia',
      x: 10,
      y: 20,
      radius: 6,
      color: '#ef4444',
      angle: 0,
      minutiaType,
    });

    const pairedMinutia = () => {
      repo.seed(
        Layer.create({
          id: 'layer-appariee',
          fingerprintId: 'fp-1',
          name: 'Minutie',
          type: 'ANNOTATION',
          zIndex: 0,
          settings: minutia(MinutiaTypeEnum.BIFURCATION),
          createdByUserId: 'user-marie',
        }),
      );
      repo.seed(
        Layer.create({
          id: 'layer-ref-1',
          fingerprintId: 'ref-1',
          name: 'Minutie',
          type: 'ANNOTATION',
          zIndex: 0,
          settings: minutia(MinutiaTypeEnum.BIFURCATION),
          createdByUserId: 'user-marie',
        }),
      );
      pairs.seed(
        MinutiaPair.fromPrimitives({
          id: 'pair-1',
          traceId: 'fp-1',
          referencePrintId: 'ref-1',
          traceMinutiaLayerId: 'layer-appariee',
          referenceMinutiaLayerId: 'layer-ref-1',
          createdByUserId: 'user-marie',
          createdAt: new Date('2026-09-01T10:00:00Z'),
        }),
      );
    };

    const typeOf = async (layerId: string) =>
      (await repo.findById(layerId))?.toPrimitives().settings.minutiaType;

    it("requalifie l'autre minutie de la paire dans la foulée", async () => {
      pairedMinutia();

      await handler.execute(
        new UpdateLayerCommand(
          EXPERT_ACTOR,
          'layer-appariee',
          undefined,
          undefined,
          undefined,
          minutia(MinutiaTypeEnum.ISLAND),
        ),
      );

      expect(await typeOf('layer-appariee')).toBe(MinutiaTypeEnum.ISLAND);
      expect(await typeOf('layer-ref-1')).toBe(MinutiaTypeEnum.ISLAND);
    });

    it("chaîne l'acte de la minutie suivie, avec le type qu'elle quitte", async () => {
      pairedMinutia();

      await handler.execute(
        new UpdateLayerCommand(
          EXPERT_ACTOR,
          'layer-appariee',
          undefined,
          undefined,
          undefined,
          minutia(MinutiaTypeEnum.ISLAND),
        ),
      );

      expect(auditTrail.events).toHaveLength(2);
      const [, followed] = auditTrail.events;
      expect(followed.eventType).toBe(AuditEventTypeEnum.LAYER_UPDATED);
      expect(followed.caseId).toBe('case-9');
      expect(followed.traceId).toBe('fp-1');
      expect(followed.payload).toMatchObject({
        layerId: 'layer-ref-1',
        settings: minutia(MinutiaTypeEnum.ISLAND),
        previousMinutiaType: MinutiaTypeEnum.BIFURCATION,
      });
    });

    it('rend les deux minuties indéterminées quand le type disparaît', async () => {
      pairedMinutia();

      await handler.execute(
        new UpdateLayerCommand(
          EXPERT_ACTOR,
          'layer-appariee',
          undefined,
          undefined,
          undefined,
          { type: 'circle', x: 10, y: 20, radius: 4, color: '#ef4444' },
        ),
      );

      expect(await typeOf('layer-appariee')).toBeUndefined();
      expect(await typeOf('layer-ref-1')).toBe(MinutiaTypeEnum.UNDETERMINED);
    });

    it("suit aussi quand c'est la minutie de l'empreinte qui change", async () => {
      pairedMinutia();

      await handler.execute(
        new UpdateLayerCommand(
          EXPERT_ACTOR,
          'layer-ref-1',
          undefined,
          undefined,
          undefined,
          minutia(MinutiaTypeEnum.RIDGE_ENDING),
        ),
      );

      expect(await typeOf('layer-appariee')).toBe(MinutiaTypeEnum.RIDGE_ENDING);
      expect(auditTrail.events.map((event) => event.traceId)).toEqual([
        null,
        'fp-1',
      ]);
    });

    it("refuse au vérificateur de requalifier la minutie d'un autre", async () => {
      repo.seed(
        Layer.create({
          id: 'layer-du-verificateur',
          fingerprintId: 'fp-1',
          name: 'Minutie',
          type: 'ANNOTATION',
          zIndex: 0,
          settings: minutia(MinutiaTypeEnum.BIFURCATION),
          createdByUserId: 'user-lucie',
        }),
      );
      repo.seed(
        Layer.create({
          id: 'layer-du-titulaire',
          fingerprintId: 'ref-1',
          name: 'Minutie',
          type: 'ANNOTATION',
          zIndex: 0,
          settings: minutia(MinutiaTypeEnum.BIFURCATION),
          createdByUserId: 'user-marie',
        }),
      );
      pairs.seed(
        MinutiaPair.fromPrimitives({
          id: 'pair-mixte',
          traceId: 'fp-1',
          referencePrintId: 'ref-1',
          traceMinutiaLayerId: 'layer-du-verificateur',
          referenceMinutiaLayerId: 'layer-du-titulaire',
          createdByUserId: 'user-marie',
          createdAt: new Date('2026-09-01T10:00:00Z'),
        }),
      );

      await expect(
        handler.execute(
          new UpdateLayerCommand(
            EXPERT_ACTOR,
            'layer-du-verificateur',
            undefined,
            undefined,
            undefined,
            minutia(MinutiaTypeEnum.ISLAND),
            'user-lucie',
          ),
        ),
      ).rejects.toBeInstanceOf(LayerNotAuthoredByVerifierError);
      expect(await typeOf('layer-du-verificateur')).toBe(
        MinutiaTypeEnum.BIFURCATION,
      );
      expect(auditTrail.events).toEqual([]);
    });

    it('laisse la déplacer sans toucher à sa jumelle', async () => {
      pairedMinutia();

      await handler.execute(
        new UpdateLayerCommand(
          EXPERT_ACTOR,
          'layer-appariee',
          undefined,
          undefined,
          undefined,
          { ...minutia(MinutiaTypeEnum.BIFURCATION), x: 99, y: 88 },
        ),
      );

      expect(
        (await repo.findById('layer-appariee'))?.toPrimitives().settings.x,
      ).toBe(99);
      expect(auditTrail.events).toHaveLength(1);
    });

    it('laisse la renommer sans toucher à ses réglages', async () => {
      pairedMinutia();

      await handler.execute(
        new UpdateLayerCommand(EXPERT_ACTOR, 'layer-appariee', 'Minutie 1'),
      );

      expect((await repo.findById('layer-appariee'))?.toPrimitives().name).toBe(
        'Minutie 1',
      );
    });
  });

  it('laisse requalifier une minutie que rien n’apparie', async () => {
    repo.seed(
      Layer.create({
        id: 'layer-libre',
        fingerprintId: 'fp-1',
        name: 'Minutie',
        type: 'ANNOTATION',
        zIndex: 0,
        settings: {
          type: 'minutia',
          x: 10,
          y: 20,
          radius: 6,
          color: '#ef4444',
          angle: 0,
          minutiaType: MinutiaTypeEnum.BIFURCATION,
        },
        createdByUserId: 'user-marie',
      }),
    );

    await handler.execute(
      new UpdateLayerCommand(
        EXPERT_ACTOR,
        'layer-libre',
        undefined,
        undefined,
        undefined,
        {
          type: 'minutia',
          x: 10,
          y: 20,
          radius: 6,
          color: '#ef4444',
          angle: 0,
          minutiaType: MinutiaTypeEnum.ISLAND,
        },
      ),
    );

    expect(
      (await repo.findById('layer-libre'))?.toPrimitives().settings.minutiaType,
    ).toBe(MinutiaTypeEnum.ISLAND);
  });

  it('lève LayerNotFoundError si le calque est introuvable', async () => {
    await expect(
      handler.execute(new UpdateLayerCommand(EXPERT_ACTOR, 'missing', 'x')),
    ).rejects.toBeInstanceOf(LayerNotFoundError);
    expect(auditTrail.events).toHaveLength(0);
  });

  it('refuse de modifier un calque dont la pièce a disparu', async () => {
    repo.seed(
      Layer.create({
        id: 'layer-orpheline',
        fingerprintId: 'fp-supprimee',
        name: 'Point',
        type: 'ANNOTATION',
        zIndex: 0,
        settings: initialSettings,
        createdByUserId: 'user-marie',
      }),
    );

    await expect(
      handler.execute(
        new UpdateLayerCommand(EXPERT_ACTOR, 'layer-orpheline', 'Minutie 1'),
      ),
    ).rejects.toBeInstanceOf(FingerprintNotFoundError);
    expect(auditTrail.events).toHaveLength(0);
  });

  it("refuse au vérificateur de modifier un calque qui n'est pas le sien", async () => {
    fingerprintLocator.setTrace('fp-1', 'case-9');
    repo.seed(
      Layer.create({
        id: 'layer-du-titulaire',
        fingerprintId: 'fp-1',
        name: 'Point',
        type: 'ANNOTATION',
        zIndex: 0,
        settings: initialSettings,
        createdByUserId: 'user-marie',
      }),
    );

    await expect(
      handler.execute(
        new UpdateLayerCommand(
          EXPERT_ACTOR,
          'layer-du-titulaire',
          'Renommé',
          undefined,
          undefined,
          undefined,
          'user-lucie',
        ),
      ),
    ).rejects.toBeInstanceOf(LayerNotAuthoredByVerifierError);
    expect(
      (await repo.findById('layer-du-titulaire'))?.toPrimitives().name,
    ).toBe('Point');
    expect(auditTrail.events).toEqual([]);
  });

  it('laisse le vérificateur modifier son propre calque', async () => {
    fingerprintLocator.setTrace('fp-1', 'case-9');
    repo.seed(
      Layer.create({
        id: 'layer-du-verificateur',
        fingerprintId: 'fp-1',
        name: 'Point',
        type: 'ANNOTATION',
        zIndex: 0,
        settings: initialSettings,
        createdByUserId: 'user-lucie',
      }),
    );

    await handler.execute(
      new UpdateLayerCommand(
        EXPERT_ACTOR,
        'layer-du-verificateur',
        'Renommé',
        undefined,
        undefined,
        undefined,
        'user-lucie',
      ),
    );

    expect(
      (await repo.findById('layer-du-verificateur'))?.toPrimitives().name,
    ).toBe('Renommé');
  });
});
