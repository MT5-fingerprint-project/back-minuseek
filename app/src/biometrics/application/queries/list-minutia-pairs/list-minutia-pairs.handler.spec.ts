import { MinutiaTypeEnum } from '../../../../shared/domain/forensics/minutiae';
import { Layer, type LayerSettings } from '../../../domain/layer/entity/layer';
import { MinutiaPair } from '../../../domain/minutia-pair/entity/minutia-pair';
import { InMemoryLayerRepository } from '../../../infrastructure/persistence/in-memory-layer.repository';
import { InMemoryMinutiaPairRepository } from '../../../infrastructure/persistence/in-memory-minutia-pair.repository';
import { ListMinutiaPairsQuery } from './list-minutia-pairs.query';
import { ListMinutiaPairsHandler } from './list-minutia-pairs.handler';

describe('ListMinutiaPairsHandler', () => {
  let handler: ListMinutiaPairsHandler;
  let layers: InMemoryLayerRepository;
  let pairs: InMemoryMinutiaPairRepository;

  const seedMinutia = (
    id: string,
    fingerprintId: string,
    createdByUserId: string | null,
    settings: LayerSettings = {
      type: 'minutia',
      x: 1,
      y: 2,
      radius: 6,
      color: '#ef4444',
      angle: 0,
      minutiaType: MinutiaTypeEnum.BIFURCATION,
    },
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

  const seedPair = (
    id: string,
    createdAt: string,
    traceMinutiaLayerId: string,
    referenceMinutiaLayerId: string,
    referencePrintId = 'ref-1',
  ) =>
    pairs.seed(
      MinutiaPair.fromPrimitives({
        id,
        traceId: 'trace-1',
        referencePrintId,
        traceMinutiaLayerId,
        referenceMinutiaLayerId,
        createdByUserId: 'user-marie',
        createdAt: new Date(createdAt),
      }),
    );

  beforeEach(() => {
    layers = new InMemoryLayerRepository();
    pairs = new InMemoryMinutiaPairRepository(layers);
    handler = new ListMinutiaPairsHandler(pairs);
  });

  it('gives nothing when the comparison carries no pair', async () => {
    expect(
      await handler.execute(new ListMinutiaPairsQuery('trace-1', 'ref-1')),
    ).toEqual([]);
  });

  it('serves the pairs numbered in the order they were posed', async () => {
    seedMinutia('lt-1', 'trace-1', 'user-marie');
    seedMinutia('lr-1', 'ref-1', 'user-marie');
    seedMinutia('lt-2', 'trace-1', 'user-marie');
    seedMinutia('lr-2', 'ref-1', 'user-marie');
    seedPair('pair-late', '2026-09-01T12:00:00Z', 'lt-2', 'lr-2');
    seedPair('pair-early', '2026-09-01T10:00:00Z', 'lt-1', 'lr-1');

    expect(
      await handler.execute(new ListMinutiaPairsQuery('trace-1', 'ref-1')),
    ).toEqual([
      {
        id: 'pair-early',
        number: 1,
        traceMinutiaLayerId: 'lt-1',
        referenceMinutiaLayerId: 'lr-1',
        minutiaType: MinutiaTypeEnum.BIFURCATION,
      },
      {
        id: 'pair-late',
        number: 2,
        traceMinutiaLayerId: 'lt-2',
        referenceMinutiaLayerId: 'lr-2',
        minutiaType: MinutiaTypeEnum.BIFURCATION,
      },
    ]);
  });

  it('breaks a tie on the creation instant by identifier', async () => {
    seedMinutia('lt-1', 'trace-1', 'user-marie');
    seedMinutia('lr-1', 'ref-1', 'user-marie');
    seedMinutia('lt-2', 'trace-1', 'user-marie');
    seedMinutia('lr-2', 'ref-1', 'user-marie');
    seedPair('pair-b', '2026-09-01T10:00:00Z', 'lt-2', 'lr-2');
    seedPair('pair-a', '2026-09-01T10:00:00Z', 'lt-1', 'lr-1');

    const served = await handler.execute(
      new ListMinutiaPairsQuery('trace-1', 'ref-1'),
    );

    expect(served.map((pair) => [pair.id, pair.number])).toEqual([
      ['pair-a', 1],
      ['pair-b', 2],
    ]);
  });

  it('leaves out the pairs of another reference print', async () => {
    seedMinutia('lt-1', 'trace-1', 'user-marie');
    seedMinutia('lr-1', 'ref-1', 'user-marie');
    seedMinutia('lt-2', 'trace-1', 'user-marie');
    seedMinutia('lr-2', 'ref-2', 'user-marie');
    seedPair('pair-1', '2026-09-01T10:00:00Z', 'lt-1', 'lr-1');
    seedPair('pair-2', '2026-09-01T11:00:00Z', 'lt-2', 'lr-2', 'ref-2');

    const served = await handler.execute(
      new ListMinutiaPairsQuery('trace-1', 'ref-1'),
    );

    expect(served.map((pair) => pair.id)).toEqual(['pair-1']);
  });

  it('shows a blind verifier only the pairs whose two minutiae are his', async () => {
    seedMinutia('lt-1', 'trace-1', 'user-marie');
    seedMinutia('lr-1', 'ref-1', 'user-marie');
    seedMinutia('lt-2', 'trace-1', 'user-lucie');
    seedMinutia('lr-2', 'ref-1', 'user-lucie');
    seedMinutia('lt-3', 'trace-1', 'user-lucie');
    seedMinutia('lr-3', 'ref-1', 'user-marie');
    seedPair('pair-operator', '2026-09-01T10:00:00Z', 'lt-1', 'lr-1');
    seedPair('pair-verifier', '2026-09-01T11:00:00Z', 'lt-2', 'lr-2');
    seedPair('pair-mixed', '2026-09-01T12:00:00Z', 'lt-3', 'lr-3');

    const served = await handler.execute(
      new ListMinutiaPairsQuery('trace-1', 'ref-1', 'user-lucie'),
    );

    expect(served.map((pair) => [pair.id, pair.number])).toEqual([
      ['pair-verifier', 1],
    ]);
  });

  it('reads the type of the pair from the trace minutia', async () => {
    seedMinutia('lt-1', 'trace-1', 'user-marie', {
      type: 'minutia',
      x: 1,
      y: 2,
      radius: 6,
      color: '#ef4444',
      angle: 0,
      minutiaType: MinutiaTypeEnum.ISLAND,
    });
    seedMinutia('lr-1', 'ref-1', 'user-marie');
    seedPair('pair-1', '2026-09-01T10:00:00Z', 'lt-1', 'lr-1');

    const [served] = await handler.execute(
      new ListMinutiaPairsQuery('trace-1', 'ref-1'),
    );

    expect(served.minutiaType).toBe(MinutiaTypeEnum.ISLAND);
  });

  it('reads a point posed before the type existed as undetermined', async () => {
    seedMinutia('lt-1', 'trace-1', 'user-marie', {
      type: 'circle',
      x: 1,
      y: 2,
      radius: 6,
      color: '#ef4444',
    });
    seedMinutia('lr-1', 'ref-1', 'user-marie');
    seedPair('pair-1', '2026-09-01T10:00:00Z', 'lt-1', 'lr-1');

    const [served] = await handler.execute(
      new ListMinutiaPairsQuery('trace-1', 'ref-1'),
    );

    expect(served.minutiaType).toBe(MinutiaTypeEnum.UNDETERMINED);
  });
});
