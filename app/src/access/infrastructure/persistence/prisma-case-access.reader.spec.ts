import type { PrismaClient } from '../../../../generated/prisma/client';
import type { TenantConnectionService } from '../../../tenancy/infrastructure/persistence/tenant-connection.service';
import { PrismaCaseAccessReader } from './prisma-case-access.reader';

const MARIE = 'user-marie';
const PIERRE = 'user-pierre';

interface CaseRow {
  id: string;
  operatorUserId: string | null;
}

interface FindManyArgs {
  where: { operatorUserId?: string };
}

interface FindFirstArgs {
  where: { id: string; operatorUserId: string };
}

class FakePrismaClient {
  constructor(private readonly cases: CaseRow[]) {}

  readonly investigationCase = {
    findFirst: (args: FindFirstArgs): Promise<{ id: string } | null> => {
      const found = this.cases.find(
        (row) =>
          row.id === args.where.id &&
          row.operatorUserId === args.where.operatorUserId,
      );
      return Promise.resolve(found ? { id: found.id } : null);
    },
    findMany: (args: FindManyArgs): Promise<{ id: string }[]> =>
      Promise.resolve(
        this.cases
          .filter((row) => row.operatorUserId === args.where.operatorUserId)
          .map((row) => ({ id: row.id })),
      ),
  };
}

function build(cases: CaseRow[]) {
  const prisma = new FakePrismaClient(cases);
  const openedClients: string[] = [];
  const tenantConnection = {
    getCurrentClient: () => {
      openedClients.push('current');
      return Promise.resolve(prisma as unknown as PrismaClient);
    },
  } as unknown as TenantConnectionService;
  return {
    reader: new PrismaCaseAccessReader(tenantConnection),
    openedClients,
  };
}

describe('PrismaCaseAccessReader', () => {
  it("reconnaît l'opérateur d'une affaire", async () => {
    const { reader } = build([{ id: 'case-1', operatorUserId: MARIE }]);

    expect(await reader.findTitle(MARIE, 'case-1')).toBe('CASE_OPERATOR');
  });

  it("ne reconnaît pas un compte qui n'est pas l'opérateur de l'affaire", async () => {
    const { reader } = build([{ id: 'case-1', operatorUserId: MARIE }]);

    expect(await reader.findTitle(PIERRE, 'case-1')).toBeNull();
  });

  it("ne reconnaît pas un opérateur sur l'affaire d'un autre", async () => {
    const { reader } = build([
      { id: 'case-1', operatorUserId: MARIE },
      { id: 'case-2', operatorUserId: PIERRE },
    ]);

    expect(await reader.findTitle(MARIE, 'case-2')).toBeNull();
  });

  it('ne reconnaît personne sur une affaire sans opérateur', async () => {
    const { reader } = build([{ id: 'case-1', operatorUserId: null }]);

    expect(await reader.findTitle(MARIE, 'case-1')).toBeNull();
  });

  it("liste les affaires dont un compte est l'opérateur", async () => {
    const { reader } = build([
      { id: 'case-1', operatorUserId: MARIE },
      { id: 'case-2', operatorUserId: PIERRE },
      { id: 'case-3', operatorUserId: MARIE },
    ]);

    expect(await reader.findCaseIdsOf(MARIE)).toEqual(['case-1', 'case-3']);
  });

  it('rend une liste vide pour un compte sans affaire', async () => {
    const { reader } = build([{ id: 'case-1', operatorUserId: MARIE }]);

    expect(await reader.findCaseIdsOf(PIERRE)).toEqual([]);
  });

  it('lit dans la base du tenant courant, jamais dans une autre', async () => {
    const { reader, openedClients } = build([
      { id: 'case-1', operatorUserId: MARIE },
    ]);

    await reader.findTitle(MARIE, 'case-1');
    await reader.findCaseIdsOf(MARIE);

    expect(openedClients).toEqual(['current', 'current']);
  });
});
