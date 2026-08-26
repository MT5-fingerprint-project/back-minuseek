import type { PrismaClient } from '../../../../generated/prisma/client';
import type { TenantConnectionService } from '../../../tenancy/infrastructure/persistence/tenant-connection.service';
import { PrismaServiceUsersReader } from './prisma-service-users.reader';

interface UserRow {
  id: string;
  role: string;
  grade: string;
  serviceNumber: string;
  identityProviderId: string;
  personalData: { firstName: string; lastName: string };
}

const MARIE: UserRow = {
  id: 'user-1',
  role: 'OPERATOR',
  grade: 'Technicien',
  serviceNumber: 'PTS-0007',
  identityProviderId: 'kc-sub-1',
  personalData: { firstName: 'Marie', lastName: 'Curie' },
};

class FakePrismaClient {
  readonly findManyArgs: unknown[] = [];

  constructor(private readonly rows: UserRow[]) {}

  readonly user = {
    findMany: (args: unknown): Promise<UserRow[]> => {
      this.findManyArgs.push(args);
      return Promise.resolve(this.rows);
    },
    count: (): Promise<number> => Promise.resolve(this.rows.length),
  };
}

function build(rows: UserRow[] = [MARIE]) {
  const prisma = new FakePrismaClient(rows);
  const openedClients: string[] = [];
  const tenantConnection = {
    getCurrentClient: () => {
      openedClients.push('current');
      return Promise.resolve(prisma as unknown as PrismaClient);
    },
    getClient: () => {
      openedClients.push('explicit');
      return Promise.resolve(prisma as unknown as PrismaClient);
    },
  } as unknown as TenantConnectionService;
  return {
    reader: new PrismaServiceUsersReader(tenantConnection),
    prisma,
    openedClients,
  };
}

describe('PrismaServiceUsersReader', () => {
  it('lit dans la base du tenant courant, jamais dans une autre', async () => {
    const { reader, openedClients } = build();

    await reader.findAll({ skip: 0, take: 20 });

    expect(openedClients).toEqual(['current']);
  });

  it('trie par nom, prénom, puis identifiant pour départager les homonymes', async () => {
    const { reader, prisma } = build();

    await reader.findAll({ skip: 0, take: 20 });

    expect(prisma.findManyArgs[0]).toMatchObject({
      orderBy: [
        { personalData: { lastName: 'asc' } },
        { personalData: { firstName: 'asc' } },
        { id: 'asc' },
      ],
    });
  });

  it('transmet la fenêtre de pagination telle quelle', async () => {
    const { reader, prisma } = build();

    await reader.findAll({ skip: 40, take: 20 });

    expect(prisma.findManyArgs[0]).toMatchObject({ skip: 40, take: 20 });
  });

  it('rend le profil du service sans le sub ni les horodatages', async () => {
    const { reader } = build();

    const { items, total } = await reader.findAll({ skip: 0, take: 20 });

    expect(items).toEqual([
      {
        id: 'user-1',
        firstName: 'Marie',
        lastName: 'Curie',
        role: 'OPERATOR',
        grade: 'Technicien',
        serviceNumber: 'PTS-0007',
      },
    ]);
    expect(total).toBe(1);
  });
});
