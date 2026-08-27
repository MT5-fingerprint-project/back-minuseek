import { InMemoryServiceUserGradesReader } from '../../../infrastructure/persistence/in-memory-service-user-grades.reader';
import { ListUserGradesHandler } from './list-user-grades.handler';

describe('ListUserGradesHandler', () => {
  let reader: InMemoryServiceUserGradesReader;
  let handler: ListUserGradesHandler;

  beforeEach(() => {
    reader = new InMemoryServiceUserGradesReader();
    handler = new ListUserGradesHandler(reader);
  });

  it('rend les grades du service, dédoublonnés et triés', async () => {
    reader.store.push('Technicien', 'Commandant', 'Technicien');

    expect(await handler.execute()).toEqual(['Commandant', 'Technicien']);
  });

  it('rend une liste vide quand le service ne compte aucun compte', async () => {
    expect(await handler.execute()).toEqual([]);
  });
});
