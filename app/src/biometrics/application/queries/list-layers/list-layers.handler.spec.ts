import { Layer } from '../../../domain/layer/entity/layer';
import { InMemoryFingerprintLocatorAdapter } from '../../../infrastructure/persistence/in-memory-fingerprint-locator.adapter';
import { InMemoryLayerRepository } from '../../../infrastructure/persistence/in-memory-layer.repository';
import { ListLayersQuery } from './list-layers.query';
import { ListLayersHandler } from './list-layers.handler';

describe('ListLayersHandler', () => {
  let handler: ListLayersHandler;
  let repo: InMemoryLayerRepository;
  let locator: InMemoryFingerprintLocatorAdapter;

  const layer = (
    id: string,
    fingerprintId: string,
    zIndex: number,
    createdByUserId: string | null = 'user-marie',
  ) =>
    Layer.create({
      id,
      fingerprintId,
      name: id,
      type: 'ANNOTATION',
      zIndex,
      settings: { type: 'circle', x: 1, y: 2, radius: 4, color: '#ffffff' },
      createdByUserId,
    });

  beforeEach(() => {
    repo = new InMemoryLayerRepository();
    locator = new InMemoryFingerprintLocatorAdapter();
    locator.setTrace('fp-1', 'case-1');
    locator.setTrace('fp-2', 'case-1');
    handler = new ListLayersHandler(repo, locator);
  });

  it('retourne les calques de la trace, triés par zIndex, en excluant les autres', async () => {
    repo.seed(layer('b', 'fp-1', 2));
    repo.seed(layer('a', 'fp-1', 0));
    repo.seed(layer('other', 'fp-2', 0));

    const result = await handler.execute(new ListLayersQuery('fp-1'));

    expect(result.map((l) => l.id)).toEqual(['a', 'b']);
  });

  it("garde l'ordre de création entre deux calques posés au même zIndex", async () => {
    repo.seed(layer('premier', 'fp-1', 3));
    repo.seed(layer('second', 'fp-1', 3));
    repo.seed(layer('troisieme', 'fp-1', 3));

    const result = await handler.execute(new ListLayersQuery('fp-1'));

    expect(result.map((posé) => posé.id)).toEqual([
      'premier',
      'second',
      'troisieme',
    ]);
  });

  it("ne rend rien d'une pièce que le localisateur ne voit plus", async () => {
    repo.seed(layer('a', 'retirée', 0));

    const result = await handler.execute(new ListLayersQuery('retirée'));

    expect(result).toEqual([]);
  });

  it("ne montre au vérificateur en mission que les calques qu'il a posés", async () => {
    repo.seed(layer('du-titulaire', 'fp-1', 0, 'user-marie'));
    repo.seed(layer('du-verificateur', 'fp-1', 1, 'user-lucie'));

    const result = await handler.execute(
      new ListLayersQuery('fp-1', 'user-lucie'),
    );

    expect(result.map((posé) => posé.id)).toEqual(['du-verificateur']);
  });

  it("ne donne au vérificateur aucun calque d'avant l'inscription des auteurs", async () => {
    repo.seed(layer('sans-auteur', 'fp-1', 0, null));

    const result = await handler.execute(
      new ListLayersQuery('fp-1', 'user-lucie'),
    );

    expect(result).toEqual([]);
  });

  it('montre tout au titulaire, comme avant', async () => {
    repo.seed(layer('du-titulaire', 'fp-1', 0, 'user-marie'));
    repo.seed(layer('du-verificateur', 'fp-1', 1, 'user-lucie'));

    const result = await handler.execute(new ListLayersQuery('fp-1'));

    expect(result.map((posé) => posé.id)).toEqual([
      'du-titulaire',
      'du-verificateur',
    ]);
  });
});
