import type { PrismaClient } from '../../../../generated/prisma/client';
import type { TenantConnectionService } from '../../../tenancy/infrastructure/persistence/tenant-connection.service';
import { PrismaTraceReader } from './prisma-trace.reader';

interface TraceRow {
  id: string;
  number: number;
  caseId: string;
  path: string;
  status: string;
  score: number | null;
  createdAt: Date;
  captureQuality: unknown;
  hits: { id: string }[];
}

function aTraceRow(overrides: Partial<TraceRow> = {}): TraceRow {
  return {
    id: 'trace-1',
    number: 1,
    caseId: 'case-9',
    path: 'media/investigation-case/case-9/traces/trace-1.png',
    status: 'RECEIVED',
    score: null,
    createdAt: new Date('2026-07-01T10:00:00.000Z'),
    captureQuality: null,
    hits: [],
    ...overrides,
  };
}

class FakePrismaClient {
  readonly findManyArgs: unknown[] = [];

  constructor(
    private readonly rows: TraceRow[],
    private readonly caseNumber: string | null,
  ) {}

  readonly trace = {
    findMany: (args: unknown): Promise<TraceRow[]> => {
      this.findManyArgs.push(args);
      return Promise.resolve(this.rows);
    },
  };

  readonly investigationCase = {
    findUnique: (): Promise<{ caseNumber: string } | null> =>
      Promise.resolve(
        this.caseNumber === null ? null : { caseNumber: this.caseNumber },
      ),
  };
}

function build(
  rows: TraceRow[] = [aTraceRow()],
  caseNumber: string | null = '3455',
) {
  const prisma = new FakePrismaClient(rows, caseNumber);
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

  it('trie par numéro croissant', async () => {
    const { reader, prisma } = build();

    await reader.findByCaseId('case-9');

    expect(prisma.findManyArgs[0]).toMatchObject({
      orderBy: { number: 'asc' },
    });
  });

  it("compose la référence avec le numéro d'affaire", async () => {
    const { reader } = build([aTraceRow({ number: 7 })]);

    const [trace] = await reader.findByCaseId('case-9');

    expect(trace.reference).toBe('3455-T7');
  });

  it('rend identifiée une trace qui porte une correspondance déclarée', async () => {
    const { reader } = build([aTraceRow({ hits: [{ id: 'hit-1' }] })]);

    const [trace] = await reader.findByCaseId('case-9');

    expect(trace.identified).toBe(true);
  });

  it('laisse non identifiée une trace sans correspondance', async () => {
    const { reader } = build();

    const [trace] = await reader.findByCaseId('case-9');

    expect(trace.identified).toBe(false);
  });

  it("ne rend rien quand l'affaire n'existe pas", async () => {
    const { reader, prisma } = build([aTraceRow()], null);

    await expect(reader.findByCaseId('case-9')).resolves.toEqual([]);
    expect(prisma.findManyArgs).toHaveLength(0);
  });

  it("rend le contrôle de netteté tel que le domaine l'a écrit", async () => {
    const { reader } = build([
      aTraceRow({ captureQuality: { blurScore: 128.4, passed: true } }),
    ]);

    const [trace] = await reader.findByCaseId('case-9');

    expect(trace.captureQuality).toEqual({ blurScore: 128.4, passed: true });
  });
});
