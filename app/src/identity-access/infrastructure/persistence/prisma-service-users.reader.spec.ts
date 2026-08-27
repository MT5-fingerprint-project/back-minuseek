import type { PrismaClient } from '../../../../generated/prisma/client';
import type { TenantConnectionService } from '../../../tenancy/infrastructure/persistence/tenant-connection.service';
import { UserRoleEnum } from '../../domain/user/value-objects/user-role.vo';
import { UserStatusEnum } from '../../domain/user/value-objects/user-status.vo';
import { ServiceUsersFilters } from '../../application/queries/list-users/service-users-filters';
import { PrismaServiceUsersReader } from './prisma-service-users.reader';

interface UserRow {
  id: string;
  role: string;
  grade: string;
  serviceNumber: string;
  status: string;
  identityProviderId: string;
  personalData: { firstName: string; lastName: string };
}

const MARIE: UserRow = {
  id: 'user-1',
  role: 'OPERATOR',
  grade: 'Technicien',
  serviceNumber: 'PTS-0007',
  status: 'DISABLED',
  identityProviderId: 'kc-sub-1',
  personalData: { firstName: 'Marie', lastName: 'Curie' },
};

class FakePrismaClient {
  readonly findManyArgs: unknown[] = [];
  readonly countArgs: unknown[] = [];

  constructor(private readonly rows: UserRow[]) {}

  readonly user = {
    findMany: (args: unknown): Promise<UserRow[]> => {
      this.findManyArgs.push(args);
      return Promise.resolve(this.rows);
    },
    count: (args: unknown): Promise<number> => {
      this.countArgs.push(args);
      return Promise.resolve(this.rows.length);
    },
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

    await reader.findAll({}, { skip: 0, take: 20 });

    expect(openedClients).toEqual(['current']);
  });

  it('trie par nom, prénom, puis identifiant pour départager les homonymes', async () => {
    const { reader, prisma } = build();

    await reader.findAll({}, { skip: 0, take: 20 });

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

    await reader.findAll({}, { skip: 40, take: 20 });

    expect(prisma.findManyArgs[0]).toMatchObject({ skip: 40, take: 20 });
  });

  it('rend le profil du service sans le sub ni les horodatages', async () => {
    const { reader } = build();

    const { items, total } = await reader.findAll({}, { skip: 0, take: 20 });

    expect(items).toEqual([
      {
        id: 'user-1',
        firstName: 'Marie',
        lastName: 'Curie',
        role: 'OPERATOR',
        grade: 'Technicien',
        serviceNumber: 'PTS-0007',
        status: 'DISABLED',
      },
    ]);
    expect(total).toBe(1);
  });

  it("n'écarte pas les comptes désactivés de la page ni du total", async () => {
    const { reader, prisma } = build();

    await reader.findAll({}, { skip: 0, take: 20 });

    expect(prisma.findManyArgs[0]).toMatchObject({ where: {} });
    expect(prisma.countArgs).toEqual([{ where: {} }]);
  });
});

describe('PrismaServiceUsersReader — filtres', () => {
  const whereOf = async (filters: ServiceUsersFilters) => {
    const { reader, prisma } = build();
    await reader.findAll(filters, { skip: 0, take: 20 });
    return (prisma.findManyArgs[0] as { where?: unknown }).where;
  };

  it('cherche le fragment dans le nom, le prénom et le matricule, sans la casse', async () => {
    expect(await whereOf({ search: '  Marchand ' })).toEqual({
      OR: [
        {
          personalData: {
            lastName: { contains: 'Marchand', mode: 'insensitive' },
          },
        },
        {
          personalData: {
            firstName: { contains: 'Marchand', mode: 'insensitive' },
          },
        },
        { serviceNumber: { contains: 'Marchand', mode: 'insensitive' } },
      ],
    });
  });

  // ILIKE lit « % » et « _ » comme des jokers : sans échappement, « % » rendrait
  // tout le service alors que le fake, qui cherche un fragment littéral, ne
  // rendrait rien. Les deux lecteurs mentiraient l'un sur l'autre.
  it.each([
    ['%', '\\%'],
    ['_', '\\_'],
    ['\\', '\\\\'],
    ['PTS_0002', 'PTS\\_0002'],
  ])('échappe le joker %s dans la clause', async (raw, escaped) => {
    const where = (await whereOf({ search: raw })) as {
      OR: { serviceNumber?: { contains: string } }[];
    };

    expect(where.OR[2].serviceNumber?.contains).toBe(escaped);
  });

  it('ne pose aucune clause pour une recherche faite d’espaces', async () => {
    expect(await whereOf({ search: '   ' })).toEqual({});
  });

  it('filtre le rôle, le grade et l’état à valeur exacte', async () => {
    expect(
      await whereOf({
        role: UserRoleEnum.OPERATOR,
        grade: 'Technicien',
        status: UserStatusEnum.DISABLED,
      }),
    ).toEqual({
      role: UserRoleEnum.OPERATOR,
      grade: 'Technicien',
      status: UserStatusEnum.DISABLED,
    });
  });

  it('combine recherche et filtres dans une seule clause', async () => {
    const where = (await whereOf({
      search: 'Curie',
      role: UserRoleEnum.ADMIN,
    })) as Record<string, unknown>;

    expect(Object.keys(where).sort()).toEqual(['OR', 'role']);
  });

  it('compte le total avec exactement la même clause que la page', async () => {
    const { reader, prisma } = build();

    await reader.findAll(
      { search: 'Curie', status: UserStatusEnum.ACTIVE },
      { skip: 0, take: 20 },
    );

    expect(prisma.countArgs).toEqual([
      { where: (prisma.findManyArgs[0] as { where: unknown }).where },
    ]);
  });

  it('garde son départage par identifiant sous filtre', async () => {
    const { reader, prisma } = build();

    await reader.findAll({ grade: 'Technicien' }, { skip: 0, take: 20 });

    expect(prisma.findManyArgs[0]).toMatchObject({
      orderBy: [
        { personalData: { lastName: 'asc' } },
        { personalData: { firstName: 'asc' } },
        { id: 'asc' },
      ],
    });
  });
});
