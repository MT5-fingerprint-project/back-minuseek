import { Layer } from '../../../domain/layer/entity/layer';
import { LayerNotFoundError } from '../../../domain/layer/errors/layer-not-found.error';
import { InMemoryLayerRepository } from '../../../infrastructure/persistence/in-memory-layer.repository';
import { DeleteLayerCommand } from './delete-layer.command';
import { DeleteLayerHandler } from './delete-layer.handler';

describe('DeleteLayerHandler', () => {
  let handler: DeleteLayerHandler;
  let repo: InMemoryLayerRepository;

  beforeEach(() => {
    repo = new InMemoryLayerRepository();
    handler = new DeleteLayerHandler(repo);
  });

  it('supprime un calque existant', async () => {
    await repo.save(
      Layer.create({
        id: 'layer-1',
        fingerprintId: 'fp-1',
        name: 'Point',
        type: 'ANNOTATION',
        zIndex: 0,
        settings: { type: 'circle', x: 10, y: 20, radius: 4, color: '#ef4444' },
      }),
    );

    await handler.execute(new DeleteLayerCommand('layer-1'));

    expect(await repo.findById('layer-1')).toBeNull();
  });

  it('lève LayerNotFoundError si le calque est introuvable', async () => {
    await expect(
      handler.execute(new DeleteLayerCommand('missing')),
    ).rejects.toBeInstanceOf(LayerNotFoundError);
  });
});
