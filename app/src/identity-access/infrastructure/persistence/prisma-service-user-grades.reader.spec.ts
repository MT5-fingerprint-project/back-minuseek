import type { PrismaClient } from '../../../../generated/prisma/client';
import type { TenantConnectionService } from '../../../tenancy/infrastructure/persistence/tenant-connection.service';
import { PrismaServiceUserGradesReader } from './prisma-service-user-grades.reader';

class FakePrismaClient {
  readonly findManyArgs: Record<string, unknown>[] = [];

  constructor(private readonly rows: { grade: string }[]) {}

  readonly user = {
    findMany: (args: Record<string, unknown>): Promise<{ grade: string }[]> => {
      this.findManyArgs.push(args);
      return Promise.resolve(this.rows);
    },
  };
}

function build(rows: { grade: string }[]) {
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
    reader: new PrismaServiceUserGradesReader(tenantConnection),
    prisma,
    openedClients,
  };
}

describe('PrismaServiceUserGradesReader', () => {
  it('rend les grades tels que Prisma les a triés et dédoublonnés', async () => {
    const { reader } = build([
      { grade: 'Commandant' },
      { grade: 'Technicien' },
    ]);

    expect(await reader.listGrades()).toEqual(['Commandant', 'Technicien']);
  });

  it('rend une liste vide quand le service ne compte aucun compte', async () => {
    const { reader } = build([]);

    expect(await reader.listGrades()).toEqual([]);
  });

  it('demande le dédoublonnage et le tri à Prisma, sans clause de filtre', async () => {
    const { reader, prisma } = build([{ grade: 'Commandant' }]);

    await reader.listGrades();

    expect(prisma.findManyArgs[0]).toEqual({
      distinct: ['grade'],
      select: { grade: true },
      orderBy: { grade: 'asc' },
    });
  });

  it('lit dans la base du tenant courant, jamais dans une autre', async () => {
    const { reader, openedClients } = build([]);

    await reader.listGrades();

    expect(openedClients).toEqual(['current']);
  });
});
