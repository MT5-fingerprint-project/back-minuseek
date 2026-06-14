import { InMemoryLayerRepository } from '../../../infrastructure/persistence/in-memory-layer.repository';
import { CreateLayerCommand } from './create-layer.command';
import { CreateLayerHandler } from './create-layer.handler';

describe('CreateLayerHandler', () => {
  let handler: CreateLayerHandler;
  let repo: InMemoryLayerRepository;

  beforeEach(() => {
    repo = new InMemoryLayerRepository();
    handler = new CreateLayerHandler(repo);
  });

  it('persiste un calque ANNOTATION visible par défaut en conservant ses settings', async () => {
    const settings = { type: 'circle', x: 10, y: 20, radius: 4, color: '#ef4444' };

    await handler.execute(
      new CreateLayerCommand(
        'layer-1',
        'fp-1',
        'Point',
        'ANNOTATION',
        0,
        settings,
      ),
    );

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
});
