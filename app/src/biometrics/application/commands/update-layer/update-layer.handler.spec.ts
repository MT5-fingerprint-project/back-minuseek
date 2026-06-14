import { Layer } from '../../../domain/layer/entity/layer';
import { LayerNotFoundError } from '../../../domain/layer/errors/layer-not-found.error';
import { InMemoryLayerRepository } from '../../../infrastructure/persistence/in-memory-layer.repository';
import { UpdateLayerCommand } from './update-layer.command';
import { UpdateLayerHandler } from './update-layer.handler';

describe('UpdateLayerHandler', () => {
  let handler: UpdateLayerHandler;
  let repo: InMemoryLayerRepository;

  beforeEach(() => {
    repo = new InMemoryLayerRepository();
    handler = new UpdateLayerHandler(repo);
  });

  it('met à jour les settings (déplacement du cercle) du calque existant', async () => {
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

    const moved = { type: 'circle', x: 99, y: 88, radius: 4, color: '#ef4444' };
    await handler.execute(
      new UpdateLayerCommand('layer-1', undefined, undefined, undefined, moved),
    );

    const saved = await repo.findById('layer-1');
    expect(saved?.toPrimitives().settings).toEqual(moved);
  });

  it('lève LayerNotFoundError si le calque est introuvable', async () => {
    await expect(
      handler.execute(new UpdateLayerCommand('missing', 'x')),
    ).rejects.toBeInstanceOf(LayerNotFoundError);
  });
});
