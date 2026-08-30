import { InMemoryHitReader } from '../../../infrastructure/persistence/in-memory-hit.reader';
import { ListHitsQuery } from './list-hits.query';
import { ListHitsHandler } from './list-hits.handler';

const DU_TITULAIRE = {
  traceId: 'trace-1',
  referencePrintId: 'ref-du-titulaire',
  declaredByUserId: 'user-marie',
};
const DU_VERIFICATEUR = {
  traceId: 'trace-1',
  referencePrintId: 'ref-du-verificateur',
  declaredByUserId: 'user-lucie',
};

describe('ListHitsHandler', () => {
  it('rend au titulaire toutes les correspondances de la trace', async () => {
    const handler = new ListHitsHandler(
      new InMemoryHitReader([DU_TITULAIRE, DU_VERIFICATEUR]),
    );

    expect(await handler.execute(new ListHitsQuery('trace-1'))).toEqual({
      referencePrintIds: ['ref-du-titulaire', 'ref-du-verificateur'],
    });
  });

  it('ne rend au vérificateur en mission que les siennes', async () => {
    const handler = new ListHitsHandler(
      new InMemoryHitReader([DU_TITULAIRE, DU_VERIFICATEUR]),
    );

    expect(
      await handler.execute(new ListHitsQuery('trace-1', 'user-lucie')),
    ).toEqual({ referencePrintIds: ['ref-du-verificateur'] });
  });

  it('ne rend au vérificateur aucune correspondance sans auteur', async () => {
    const handler = new ListHitsHandler(
      new InMemoryHitReader([{ ...DU_TITULAIRE, declaredByUserId: null }]),
    );

    expect(
      await handler.execute(new ListHitsQuery('trace-1', 'user-lucie')),
    ).toEqual({ referencePrintIds: [] });
  });

  it("ne rend rien d'une autre trace", async () => {
    const handler = new ListHitsHandler(
      new InMemoryHitReader([{ ...DU_TITULAIRE, traceId: 'trace-2' }]),
    );

    expect(await handler.execute(new ListHitsQuery('trace-1'))).toEqual({
      referencePrintIds: [],
    });
  });
});
