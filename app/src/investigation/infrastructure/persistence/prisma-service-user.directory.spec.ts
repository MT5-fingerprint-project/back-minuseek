import type { PrismaClient } from '../../../../generated/prisma/client';
import type { TenantConnectionService } from '../../../tenancy/infrastructure/persistence/tenant-connection.service';
import { PrismaServiceUserDirectory } from './prisma-service-user.directory';

interface UserRow {
  id: string;
  status: string;
  personalData: { firstName: string; lastName: string };
}

class FakePrismaClient {
  readonly findUniqueArgs: Record<string, unknown>[] = [];

  constructor(private readonly row: UserRow | null) {}

  readonly user = {
    findUnique: (args: Record<string, unknown>): Promise<UserRow | null> => {
      this.findUniqueArgs.push(args);
      return Promise.resolve(this.row);
    },
  };
}

const MARIE = { firstName: 'Marie', lastName: 'Curie' };

function build(row: UserRow | null) {
  const prisma = new FakePrismaClient(row);
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
    directory: new PrismaServiceUserDirectory(tenantConnection),
    prisma,
    openedClients,
  };
}

describe('PrismaServiceUserDirectory', () => {
  it('rend un compte actif comme désignable', async () => {
    const { directory } = build({
      id: 'user-1',
      status: 'ACTIVE',
      personalData: MARIE,
    });

    expect(await directory.findById('user-1')).toEqual({
      id: 'user-1',
      disabled: false,
      firstName: 'Marie',
      lastName: 'Curie',
    });
  });

  it('rend un compte désactivé, sans le confondre avec une absence', async () => {
    const { directory } = build({
      id: 'user-1',
      status: 'DISABLED',
      personalData: MARIE,
    });

    expect(await directory.findById('user-1')).toEqual({
      id: 'user-1',
      disabled: true,
      firstName: 'Marie',
      lastName: 'Curie',
    });
  });

  it("traite tout état autre qu'ACTIVE comme non désignable", async () => {
    const { directory } = build({
      id: 'user-1',
      status: 'SUSPENDED',
      personalData: MARIE,
    });

    expect(await directory.findById('user-1')).toEqual({
      id: 'user-1',
      disabled: true,
      firstName: 'Marie',
      lastName: 'Curie',
    });
  });

  it('rend null pour un identifiant absent de la base courante', async () => {
    const { directory } = build(null);

    expect(await directory.findById('user-fantome')).toBeNull();
  });

  it("sélectionne l'état plutôt que de filtrer dessus", async () => {
    const { directory, prisma } = build({
      id: 'user-1',
      status: 'DISABLED',
      personalData: MARIE,
    });

    await directory.findById('user-1');

    expect(prisma.findUniqueArgs[0]).toEqual({
      where: { id: 'user-1' },
      select: {
        id: true,
        status: true,
        role: true,
        personalData: { select: { firstName: true, lastName: true } },
      },
    });
  });

  it('rend le nom du compte, que la chaîne inscrit avec son identifiant', async () => {
    const { directory } = build({
      id: 'user-1',
      status: 'ACTIVE',
      personalData: { firstName: 'Pierre', lastName: 'Martin' },
    });

    const found = await directory.findById('user-1');

    expect(found).toMatchObject({ firstName: 'Pierre', lastName: 'Martin' });
  });

  it('lit dans la base du tenant courant, jamais dans une autre', async () => {
    const { directory, openedClients } = build({
      id: 'user-1',
      status: 'ACTIVE',
      personalData: MARIE,
    });

    await directory.findById('user-1');

    expect(openedClients).toEqual(['current']);
  });
});
