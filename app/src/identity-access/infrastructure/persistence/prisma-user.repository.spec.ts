import type { PrismaClient } from '../../../../generated/prisma/client';
import type { TenantConnectionService } from '../../../tenancy/infrastructure/persistence/tenant-connection.service';
import { User } from '../../domain/user/entity/user';
import { UserRole } from '../../domain/user/value-objects/user-role.vo';
import { UserStatusEnum } from '../../domain/user/value-objects/user-status.vo';
import { PersonalData } from '../../domain/user/value-objects/personal-data.vo';
import { PrismaUserRepository } from './prisma-user.repository';

const ROW = {
  id: 'user-1',
  identityProviderId: 'kc-sub-1',
  role: 'OPERATOR',
  grade: 'Technicien',
  serviceNumber: 'PTS-0007',
  status: 'DISABLED',
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-02-01T00:00:00.000Z'),
  personalData: { firstName: 'Marie', lastName: 'Curie' },
};

class FakePrismaClient {
  readonly upsertArgs: Record<string, unknown>[] = [];
  readonly findUniqueArgs: Record<string, unknown>[] = [];

  constructor(private readonly row: typeof ROW | null) {}

  readonly user = {
    upsert: (args: Record<string, unknown>): Promise<unknown> => {
      this.upsertArgs.push(args);
      return Promise.resolve({});
    },
    findUnique: (args: Record<string, unknown>): Promise<unknown> => {
      this.findUniqueArgs.push(args);
      return Promise.resolve(this.row);
    },
  };
}

function build(row: typeof ROW | null = ROW) {
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
    repository: new PrismaUserRepository(tenantConnection),
    prisma,
    openedClients,
  };
}

function aDisabledUser(): User {
  const user = User.register({
    id: 'user-1',
    identityProviderId: 'kc-sub-1',
    role: UserRole.operator(),
    grade: 'Technicien',
    serviceNumber: 'PTS-0007',
    personalData: PersonalData.of({ firstName: 'Marie', lastName: 'Curie' }),
  });
  user.disable();
  return user;
}

describe('PrismaUserRepository', () => {
  it('écrit tout le compte, état compris, dans la branche de création', async () => {
    const { repository, prisma } = build();
    const user = aDisabledUser();

    await repository.save(user);

    expect(prisma.upsertArgs[0].where).toEqual({ id: 'user-1' });
    expect(prisma.upsertArgs[0].create).toEqual({
      id: 'user-1',
      identityProviderId: 'kc-sub-1',
      role: 'OPERATOR',
      grade: 'Technicien',
      serviceNumber: 'PTS-0007',
      status: UserStatusEnum.DISABLED,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      personalData: { create: { firstName: 'Marie', lastName: 'Curie' } },
    });
  });

  it('réécrit tout ce qui peut changer, état compris, en mise à jour', async () => {
    const { repository, prisma } = build();
    const user = aDisabledUser();

    await repository.save(user);

    // Ni l'identifiant du fournisseur ni createdAt : les deux sont posés à la
    // création et ne bougent plus.
    expect(prisma.upsertArgs[0].update).toEqual({
      role: 'OPERATOR',
      grade: 'Technicien',
      serviceNumber: 'PTS-0007',
      status: UserStatusEnum.DISABLED,
      updatedAt: user.updatedAt,
      personalData: { update: { firstName: 'Marie', lastName: 'Curie' } },
    });
  });

  it('reconstitue un compte avec son état depuis la ligne lue', async () => {
    const { repository } = build();

    const found = await repository.findById('user-1');

    expect(found?.toPrimitives()).toEqual({
      id: 'user-1',
      identityProviderId: 'kc-sub-1',
      role: 'OPERATOR',
      grade: 'Technicien',
      serviceNumber: 'PTS-0007',
      status: 'DISABLED',
      firstName: 'Marie',
      lastName: 'Curie',
      createdAt: ROW.createdAt,
      updatedAt: ROW.updatedAt,
    });
  });

  it('rend null pour un identifiant absent de la base courante', async () => {
    const { repository } = build(null);

    expect(await repository.findById('inconnu')).toBeNull();
  });

  it('lit le profil rattaché, sans quoi la reconstitution est impossible', async () => {
    const { repository, prisma } = build();

    await repository.findById('user-1');

    expect(prisma.findUniqueArgs[0]).toEqual({
      where: { id: 'user-1' },
      include: { personalData: true },
    });
  });

  it('lit et écrit dans la base du tenant courant, jamais dans une autre', async () => {
    const { repository, openedClients } = build();

    await repository.save(aDisabledUser());
    await repository.findById('user-1');

    expect(openedClients).toEqual(['current', 'current']);
  });
});
