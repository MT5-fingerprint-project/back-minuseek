import type { PrismaClient } from '../../../../generated/prisma/client';
import type { TenantConnectionService } from '../../../tenancy/infrastructure/persistence/tenant-connection.service';
import { PrismaTraceReader } from './prisma-trace.reader';

interface TraceRow {
  id: string;
  caseId: string;
  path: string;
  status: string;
  score: number | null;
  createdAt: Date;
  captureQuality: unknown;
}

function aTraceRow(overrides: Partial<TraceRow> = {}): TraceRow {
  return {
    id: 'trace-1',
    caseId: 'case-9',
    path: 'media/investigation-case/case-9/traces/trace-1.png',
    status: 'RECEIVED',
    score: null,
    createdAt: new Date('2026-07-01T10:00:00.000Z'),
    captureQuality: null,
    ...overrides,
  };
}

class FakePrismaClient {
  readonly findManyArgs: unknown[] = [];

  constructor(private readonly rows: TraceRow[]) {}

  readonly trace = {
    findMany: (args: unknown): Promise<TraceRow[]> => {
      this.findManyArgs.push(args);
      return Promise.resolve(this.rows);
    },
  };
}

function build(rows: TraceRow[] = [aTraceRow()]) {
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
    reader: new PrismaTraceReader(tenantConnection),
    prisma,
    openedClients,
  };
}

describe('PrismaTraceReader', () => {
  it('lit dans la base du tenant courant, jamais dans une autre', async () => {
    const { reader, openedClients } = build();

    await reader.findByCaseId('case-9');

    expect(openedClients).toEqual(['current']);
  });

  it("ne demande que les traces de l'affaire visée", async () => {
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

  it("rend le contrôle de netteté tel que le domaine l'a écrit", async () => {
    const { reader } = build([
      aTraceRow({ captureQuality: { blurScore: 128.4, passed: true } }),
    ]);

    const [trace] = await reader.findByCaseId('case-9');

    expect(trace.captureQuality).toEqual({ blurScore: 128.4, passed: true });
  });
});
