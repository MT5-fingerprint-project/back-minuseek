import type { PrismaClient } from '../../../../generated/prisma/client';
import type { TenantConnectionService } from '../../../tenancy/infrastructure/persistence/tenant-connection.service';
import { PrismaHitReader } from './prisma-hit.reader';

interface HitRow {
  traceId: string;
  referencePrintId: string;
}

class FakePrismaClient {
  readonly findManyArgs: unknown[] = [];

  constructor(private readonly rows: HitRow[]) {}

  readonly hit = {
    findMany: (args: unknown): Promise<HitRow[]> => {
      this.findManyArgs.push(args);
      return Promise.resolve(this.rows);
    },
  };
}

function build(
  rows: HitRow[] = [{ traceId: 'trace-1', referencePrintId: 'ref-1' }],
) {
  const prisma = new FakePrismaClient(rows);
  const tenantConnection = {
    getCurrentClient: () => Promise.resolve(prisma as unknown as PrismaClient),
  } as unknown as TenantConnectionService;
  return { reader: new PrismaHitReader(tenantConnection), prisma };
}

describe('PrismaHitReader', () => {
  it('ne demande que les correspondances du vérificateur quand il lit en aveugle', async () => {
    const { reader, prisma } = build();

    await reader.findByTraceId('trace-1', 'user-lucie');

    expect(prisma.findManyArgs[0]).toMatchObject({
      where: { traceId: 'trace-1', declaredByUserId: 'user-lucie' },
    });
  });

  it("ne filtre pas sur l'auteur pour le titulaire", async () => {
    const { reader, prisma } = build();

    await reader.findByTraceId('trace-1');

    expect(prisma.findManyArgs[0]).not.toMatchObject({
      where: { declaredByUserId: expect.anything() as unknown },
    });
  });

  it('laisse de côté les pièces retirées du dossier', async () => {
    const { reader, prisma } = build();

    await reader.findByTraceId('trace-1');

    expect(prisma.findManyArgs[0]).toMatchObject({
      where: {
        withdrawnAt: null,
        trace: { withdrawnAt: null },
        referencePrint: { withdrawnAt: null },
      },
    });
  });
});
