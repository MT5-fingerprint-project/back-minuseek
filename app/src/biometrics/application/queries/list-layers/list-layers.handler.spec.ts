import { Layer } from '../../../domain/layer/entity/layer';
import { InMemoryLayerRepository } from '../../../infrastructure/persistence/in-memory-layer.repository';
import { ListLayersQuery } from './list-layers.query';
import { ListLayersHandler } from './list-layers.handler';

describe('ListLayersHandler', () => {
  let handler: ListLayersHandler;
  let repo: InMemoryLayerRepository;

  const layer = (id: string, fingerprintId: string, zIndex: number) =>
    Layer.create({
      id,
      fingerprintId,
      name: id,
      type: 'ANNOTATION',
      zIndex,
      settings: { type: 'circle', x: 1, y: 2, radius: 4, color: '#ffffff' },
    });

  beforeEach(() => {
    repo = new InMemoryLayerRepository();
    handler = new ListLayersHandler(repo);
  });

  it('retourne les calques de la trace, triés par zIndex, en excluant les autres', async () => {
    await repo.save(layer('b', 'fp-1', 2));
    await repo.save(layer('a', 'fp-1', 0));
    await repo.save(layer('other', 'fp-2', 0));

    const result = await handler.execute(new ListLayersQuery('fp-1'));

    expect(result.map((l) => l.id)).toEqual(['a', 'b']);
  });
});
