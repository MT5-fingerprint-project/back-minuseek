import { InMemoryRecipientBookEntriesReader } from '../../../infrastructure/persistence/in-memory-recipient-book-entries.reader';
import { ListRecipientBookEntriesHandler } from './list-recipient-book-entries.handler';

const entry = (id: string, authority: string) => ({
  id,
  authority,
  attentionQuality: null,
  attentionName: null,
});

describe('ListRecipientBookEntriesHandler', () => {
  let reader: InMemoryRecipientBookEntriesReader;
  let handler: ListRecipientBookEntriesHandler;

  beforeEach(() => {
    reader = new InMemoryRecipientBookEntriesReader();
    handler = new ListRecipientBookEntriesHandler(reader);
  });

  it('rend le carnet trié par autorité', async () => {
    reader.store.push(
      entry('c', 'Le Procureur de la République'),
      entry('a', 'Le Commissaire Général'),
      entry('b', 'Madame la Juge d’instruction'),
    );

    const { data } = await handler.execute();

    expect(data.map((row) => row.authority)).toEqual([
      'Le Commissaire Général',
      'Le Procureur de la République',
      'Madame la Juge d’instruction',
    ]);
  });

  // `authority` n'est pas unique : sans départage, deux homonymes sortiraient
  // dans un ordre libre d'un appel à l'autre.
  it('départage deux autorités homonymes par leur identifiant', async () => {
    reader.store.push(
      entry('z', 'Le Procureur de la République'),
      entry('a', 'Le Procureur de la République'),
    );

    const { data } = await handler.execute();

    expect(data.map((row) => row.id)).toEqual(['a', 'z']);
  });

  it('rend un carnet vide sans se plaindre', async () => {
    await expect(handler.execute()).resolves.toEqual({ data: [] });
  });
});
