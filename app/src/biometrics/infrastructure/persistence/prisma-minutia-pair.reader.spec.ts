import type { PrismaClient } from '../../../../generated/prisma/client';
import { MinutiaTypeEnum } from '../../../shared/domain/forensics/minutiae';
import type { TenantConnectionService } from '../../../tenancy/infrastructure/persistence/tenant-connection.service';
import { PrismaMinutiaPairReader } from './prisma-minutia-pair.reader';

interface Row {
  id: string;
  createdAt: Date;
  traceMinutiaLayerId: string;
  referenceMinutiaLayerId: string;
  traceMinutia: { settings: unknown };
}

class FakePrismaClient {
  findManyArgs: unknown[] = [];
  rows: Row[] = [];

  readonly minutiaPair = {
    findMany: (args: unknown): Promise<Row[]> => {
      this.findManyArgs.push(args);
      return Promise.resolve(this.rows);
    },
  };
}

function build() {
  const prisma = new FakePrismaClient();
  const tenantConnection = {
    getCurrentClient: () => Promise.resolve(prisma as unknown as PrismaClient),
  } as unknown as TenantConnectionService;

  return { prisma, reader: new PrismaMinutiaPairReader(tenantConnection) };
}

function aRow(settings: unknown): Row {
  return {
    id: 'pair-1',
    createdAt: new Date('2026-09-01T10:00:00.000Z'),
    traceMinutiaLayerId: 'layer-trace-1',
    referenceMinutiaLayerId: 'layer-ref-1',
    traceMinutia: { settings },
  };
}

describe('PrismaMinutiaPairReader', () => {
  it('asks only for the pairs of that comparison', async () => {
    const { reader, prisma } = build();

    await reader.findByTraceAndReferencePrint('trace-1', 'ref-1');

    expect(prisma.findManyArgs[0]).toMatchObject({
      where: { traceId: 'trace-1', referencePrintId: 'ref-1' },
    });
  });

  it('asks for nothing but the verifier’s own two minutiae in blind verification', async () => {
    const { reader, prisma } = build();

    await reader.findByTraceAndReferencePrint('trace-1', 'ref-1', 'user-lucie');

    expect(prisma.findManyArgs[0]).toMatchObject({
      where: {
        traceId: 'trace-1',
        referencePrintId: 'ref-1',
        traceMinutia: { createdByUserId: 'user-lucie' },
        referenceMinutia: { createdByUserId: 'user-lucie' },
      },
    });
  });

  it('does not filter by author outside blind verification', async () => {
    const { reader, prisma } = build();

    await reader.findByTraceAndReferencePrint('trace-1', 'ref-1', null);

    expect(prisma.findManyArgs[0]).toEqual({
      where: { traceId: 'trace-1', referencePrintId: 'ref-1' },
      select: {
        id: true,
        createdAt: true,
        traceMinutiaLayerId: true,
        referenceMinutiaLayerId: true,
        traceMinutia: { select: { settings: true } },
      },
    });
  });

  it('serves the type carried by the trace minutia', async () => {
    const { reader, prisma } = build();
    prisma.rows = [aRow({ type: 'minutia', minutiaType: 'ISLAND' })];

    const [row] = await reader.findByTraceAndReferencePrint('trace-1', 'ref-1');

    expect(row).toEqual({
      id: 'pair-1',
      createdAt: new Date('2026-09-01T10:00:00.000Z'),
      traceMinutiaLayerId: 'layer-trace-1',
      referenceMinutiaLayerId: 'layer-ref-1',
      minutiaType: MinutiaTypeEnum.ISLAND,
    });
  });

  it('serves an undetermined type when the minutia carries none', async () => {
    const { reader, prisma } = build();
    prisma.rows = [aRow({ type: 'circle' })];

    const [row] = await reader.findByTraceAndReferencePrint('trace-1', 'ref-1');

    expect(row.minutiaType).toBe(MinutiaTypeEnum.UNDETERMINED);
  });
});
