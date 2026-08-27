import type { PrismaClient } from '../../../../generated/prisma/client';
import type { TenantConnectionService } from '../../../tenancy/infrastructure/persistence/tenant-connection.service';
import { PrismaReferencePrintReader } from './prisma-reference-print.reader';

interface ReferencePrintRow {
  id: string;
  caseId: string;
  path: string;
  subjectId: string | null;
  position: string | null;
  createdAt: Date;
  matchings: { traceId: string; score: number; match: boolean }[];
}

function aReferencePrintRow(
  overrides: Partial<ReferencePrintRow> = {},
): ReferencePrintRow {
  return {
    id: 'ref-1',
    caseId: 'case-9',
    path: 'media/investigation-case/case-9/reference-prints/ref-1.png',
    subjectId: null,
    position: null,
    createdAt: new Date('2026-07-01T10:00:00.000Z'),
    matchings: [],
    ...overrides,
  };
}

class FakePrismaClient {
  readonly findManyArgs: unknown[] = [];

  constructor(private readonly rows: ReferencePrintRow[]) {}

  readonly referencePrint = {
    findMany: (args: unknown): Promise<ReferencePrintRow[]> => {
      this.findManyArgs.push(args);
      return Promise.resolve(this.rows);
    },
  };
}

function build(rows: ReferencePrintRow[] = [aReferencePrintRow()]) {
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
    reader: new PrismaReferencePrintReader(tenantConnection),
    prisma,
    openedClients,
  };
}

describe('PrismaReferencePrintReader', () => {
  it('lit dans la base du tenant courant, jamais dans une autre', async () => {
    const { reader, openedClients } = build();

    await reader.findByCaseId('case-9');

    expect(openedClients).toEqual(['current']);
  });

  it("ne demande que les empreintes de l'affaire visée", async () => {
    const { reader, prisma } = build();

    await reader.findByCaseId('case-9');

    expect(prisma.findManyArgs[0]).toMatchObject({
      where: { caseId: 'case-9' },
    });
  });

  it('trie de la plus récente à la plus ancienne, puis départage par identifiant', async () => {
    const { reader, prisma } = build();

    await reader.findByCaseId('case-9');

    expect(prisma.findManyArgs[0]).toMatchObject({
      orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
    });
  });

  it('joint les rapprochements de chaque empreinte, score et verdict compris', async () => {
    const { reader, prisma } = build();

    await reader.findByCaseId('case-9');

    expect(prisma.findManyArgs[0]).toMatchObject({
      include: {
        matchings: { select: { traceId: true, score: true, match: true } },
      },
    });
  });
});
