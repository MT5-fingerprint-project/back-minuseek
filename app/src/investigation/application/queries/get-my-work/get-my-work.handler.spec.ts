import {
  EMPTY_MY_WORK,
  InMemoryMyWorkReader,
} from '../../../infrastructure/persistence/in-memory-my-work.reader';
import { GetMyWorkHandler } from './get-my-work.handler';
import { GetMyWorkQuery } from './get-my-work.query';
import { MyWorkReadModel } from './my-work-read-model';

const NADIA = '11111111-1111-4111-8111-111111111111';
const THOMAS = '22222222-2222-4222-8222-222222222222';

function workOf(open: number): MyWorkReadModel {
  return {
    ...EMPTY_MY_WORK,
    cases: { ...EMPTY_MY_WORK.cases, open },
  };
}

describe('GetMyWorkHandler', () => {
  it('rend le travail de l opérateur désigné par la query', async () => {
    const reader = new InMemoryMyWorkReader(new Map([[NADIA, workOf(12)]]));
    const handler = new GetMyWorkHandler(reader);

    const work = await handler.execute(new GetMyWorkQuery(NADIA));

    expect(work.cases.open).toBe(12);
  });

  it('ne lit jamais le travail d un autre opérateur que celui de la query', async () => {
    const reader = new InMemoryMyWorkReader(
      new Map([
        [NADIA, workOf(12)],
        [THOMAS, workOf(47)],
      ]),
    );
    const handler = new GetMyWorkHandler(reader);

    const work = await handler.execute(new GetMyWorkQuery(NADIA));

    expect(work.cases.open).toBe(12);
    expect(reader.readFor).toEqual([NADIA]);
  });

  it('rend un travail vide pour un opérateur sans dossier, sans lever', async () => {
    const reader = new InMemoryMyWorkReader();
    const handler = new GetMyWorkHandler(reader);

    const work = await handler.execute(new GetMyWorkQuery(NADIA));

    expect(work.cases.open).toBe(0);
    expect(work.discordances).toEqual([]);
    expect(work.pendingTraces).toEqual([]);
  });
});
