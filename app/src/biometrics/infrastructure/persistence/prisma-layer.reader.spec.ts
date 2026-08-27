import type { PrismaClient } from '../../../../generated/prisma/client';
import type { TenantConnectionService } from '../../../tenancy/infrastructure/persistence/tenant-connection.service';
import { PrismaLayerReader } from './prisma-layer.reader';

interface LayerRow {
  id: string;
  fingerprintId: string;
  name: string;
  type: string;
  zIndex: number;
  isVisible: boolean;
  settings: unknown;
  createdAt: Date;
}

function aLayerRow(overrides: Partial<LayerRow> = {}): LayerRow {
  return {
    id: 'layer-1',
    fingerprintId: 'fp-1',
    name: 'Contraste',
    type: 'FILTER',
    zIndex: 0,
    isVisible: true,
    settings: { filterKey: 'contrast', value: 1.2 },
    createdAt: new Date('2026-07-01T10:00:00.000Z'),
    ...overrides,
  };
}

class FakePrismaClient {
  readonly findManyArgs: unknown[] = [];

  constructor(private readonly rows: LayerRow[]) {}

  readonly layer = {
    findMany: (args: unknown): Promise<LayerRow[]> => {
      this.findManyArgs.push(args);
      return Promise.resolve(this.rows);
    },
  };
}

function build(rows: LayerRow[] = [aLayerRow()]) {
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
    reader: new PrismaLayerReader(tenantConnection),
    prisma,
    openedClients,
  };
}

describe('PrismaLayerReader', () => {
  it('lit dans la base du tenant courant, jamais dans une autre', async () => {
    const { reader, openedClients } = build();

    await reader.findByFingerprintId('fp-1');

    expect(openedClients).toEqual(['current']);
  });

  it("ne demande que les calques de l'image visée", async () => {
    const { reader, prisma } = build();

    await reader.findByFingerprintId('fp-1');

    expect(prisma.findManyArgs[0]).toMatchObject({
      where: { fingerprintId: 'fp-1' },
    });
  });

  // L'empilement est métier-significatif : deux calques au même zIndex ne
  // doivent pas changer d'ordre d'un affichage à l'autre.
  it('empile par zIndex, puis par ordre de création, puis départage par identifiant', async () => {
    const { reader, prisma } = build();

    await reader.findByFingerprintId('fp-1');

    expect(prisma.findManyArgs[0]).toMatchObject({
      orderBy: [{ zIndex: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }],
    });
  });

  it('rend les réglages du calque tels que le domaine les a écrits', async () => {
    const { reader } = build();

    const [layer] = await reader.findByFingerprintId('fp-1');

    expect(layer.settings).toEqual({ filterKey: 'contrast', value: 1.2 });
  });
});
