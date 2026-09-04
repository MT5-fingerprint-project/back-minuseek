import type { PrismaClient } from '../../../../generated/prisma/client';
import type { TenantConnectionService } from '../../../tenancy/infrastructure/persistence/tenant-connection.service';
import { PrismaCaseReportDataReader } from './prisma-case-report-data.reader';

const AT = new Date('2026-08-01T09:00:00.000Z');

interface LayerSeed {
  id: string;
  fingerprintId: string;
  name?: string;
  type?: string;
  zIndex?: number;
  isVisible?: boolean;
  settings: Record<string, unknown>;
}

interface PairSeed {
  id: string;
  traceId: string;
  referencePrintId: string;
  traceMinutiaLayerId: string;
  referenceMinutiaLayerId: string;
  createdAt?: Date;
}

interface CaseSeed {
  requestDate?: Date | null;
  requesterQuality?: string | null;
  requesterName?: string | null;
  requesterService?: string | null;
  offenseNature?: string | null;
  offenseLocation?: string | null;
  offenseDateFrom?: Date | null;
  offenseDateTo?: Date | null;
  interventionDate?: Date | null;
  caseAgainst?: string | null;
  recipientAuthority?: string | null;
  recipientAttentionQuality?: string | null;
  recipientAttentionName?: string | null;
}

interface PieceSeed {
  id: string;
  number?: number;
  status?: string;
  path?: string;
}

class FakePrismaClient {
  minutiaPairFindManyArgs: unknown[] = [];
  caseSeed: CaseSeed = {};
  traceSeeds: PieceSeed[] = [];
  printSeeds: PieceSeed[] = [];
  layerSeeds: LayerSeed[] = [];
  pairSeeds: PairSeed[] = [];

  readonly investigationCase = {
    findUnique: () =>
      Promise.resolve({
        id: 'case-1',
        caseNumber: '3455',
        pvNumber: 'PV-2026-001',
        description: null,
        status: 'OPEN',
        createdAt: AT,
        requestDate: null,
        requesterQuality: null,
        requesterName: null,
        requesterService: null,
        offenseNature: null,
        offenseLocation: null,
        offenseDateFrom: null,
        offenseDateTo: null,
        interventionDate: null,
        caseAgainst: null,
        recipientAuthority: null,
        recipientAttentionQuality: null,
        recipientAttentionName: null,
        ...this.caseSeed,
      }),
  };

  readonly trace = {
    findMany: () =>
      Promise.resolve(
        this.traceSeeds.map((seed) => ({
          id: seed.id,
          path: seed.path ?? `media/case-1/${seed.id}.png`,
          sha256: null,
          createdAt: AT,
          withdrawnAt: null,
          number: seed.number ?? 1,
          status: seed.status ?? 'EXPLOITABLE',
          locationPhoto: null,
        })),
      ),
  };

  readonly referencePrint = {
    findMany: () =>
      Promise.resolve(
        this.printSeeds.map((seed) => ({
          id: seed.id,
          path: seed.path ?? `media/case-1/${seed.id}.png`,
          sha256: null,
          createdAt: AT,
          withdrawnAt: null,
        })),
      ),
  };

  readonly subject = { findMany: () => Promise.resolve([]) };

  readonly layer = {
    findMany: () =>
      Promise.resolve(
        this.layerSeeds.map((seed) => ({
          id: seed.id,
          fingerprintId: seed.fingerprintId,
          name: seed.name ?? 'Minutie',
          type: seed.type ?? 'ANNOTATION',
          zIndex: seed.zIndex ?? 0,
          isVisible: seed.isVisible ?? true,
          settings: seed.settings,
        })),
      ),
  };

  readonly matching = { findMany: () => Promise.resolve([]) };
  readonly hit = { findMany: () => Promise.resolve([]) };
  readonly caseExpertise = { findUnique: () => Promise.resolve(null) };
  readonly user = { findMany: () => Promise.resolve([]) };
  readonly caseVerification = { findMany: () => Promise.resolve([]) };
  readonly verificationDecision = { findMany: () => Promise.resolve([]) };

  readonly minutiaPair = {
    findMany: (args: unknown) => {
      this.minutiaPairFindManyArgs.push(args);
      return Promise.resolve(
        this.pairSeeds.map((seed) => ({
          id: seed.id,
          traceId: seed.traceId,
          referencePrintId: seed.referencePrintId,
          traceMinutiaLayerId: seed.traceMinutiaLayerId,
          referenceMinutiaLayerId: seed.referenceMinutiaLayerId,
          createdAt: seed.createdAt ?? AT,
        })),
      );
    },
  };
}

function build() {
  const prisma = new FakePrismaClient();
  const tenantConnection = {
    getCurrentClient: () => Promise.resolve(prisma as unknown as PrismaClient),
  } as unknown as TenantConnectionService;

  return { prisma, reader: new PrismaCaseReportDataReader(tenantConnection) };
}

async function readCase(
  prisma: FakePrismaClient,
  reader: PrismaCaseReportDataReader,
) {
  const data = await reader.read('case-1');
  if (data === null) {
    throw new Error('le dossier de test devrait exister');
  }
  return data;
}

describe('PrismaCaseReportDataReader — minuties', () => {
  it('sert l’identifiant du calque avec la minutie', async () => {
    const { prisma, reader } = build();
    prisma.traceSeeds = [{ id: 't1' }];
    prisma.layerSeeds = [
      {
        id: 'layer-42',
        fingerprintId: 't1',
        settings: { type: 'minutia', x: 10, y: 20 },
      },
    ];

    const data = await readCase(prisma, reader);

    expect(data.traces[0].minutiae[0].id).toBe('layer-42');
  });

  it('lit l’orientation sous la clé écrite par l’atelier', async () => {
    const { prisma, reader } = build();
    prisma.traceSeeds = [{ id: 't1' }];
    prisma.layerSeeds = [
      {
        id: 'layer-1',
        fingerprintId: 't1',
        settings: { type: 'minutia', x: 10, y: 20, angle: 135 },
      },
    ];

    const data = await readCase(prisma, reader);

    expect(data.traces[0].minutiae[0].angleDeg).toBe(135);
  });

  it('n’invente aucune orientation à partir d’une clé qui n’existe nulle part', async () => {
    const { prisma, reader } = build();
    prisma.traceSeeds = [{ id: 't1' }];
    prisma.layerSeeds = [
      {
        id: 'layer-1',
        fingerprintId: 't1',
        settings: { type: 'minutia', x: 10, y: 20, angleDeg: 90 },
      },
    ];

    const data = await readCase(prisma, reader);

    expect(data.traces[0].minutiae[0].angleDeg).toBeNull();
  });

  it('nomme le type de la minutie en français', async () => {
    const { prisma, reader } = build();
    prisma.traceSeeds = [{ id: 't1' }];
    prisma.layerSeeds = [
      {
        id: 'layer-1',
        fingerprintId: 't1',
        settings: {
          type: 'minutia',
          x: 10,
          y: 20,
          minutiaType: 'RIDGE_ENDING',
        },
      },
    ];

    const data = await readCase(prisma, reader);

    expect(data.traces[0].minutiae[0].typeLabel).toBe('arrêt de ligne');
  });

  it('nomme indéterminée une minutie posée sans type', async () => {
    const { prisma, reader } = build();
    prisma.traceSeeds = [{ id: 't1' }];
    prisma.layerSeeds = [
      {
        id: 'layer-1',
        fingerprintId: 't1',
        settings: { type: 'circle', x: 10, y: 20 },
      },
    ];

    const data = await readCase(prisma, reader);

    expect(data.traces[0].minutiae[0].typeLabel).toBe('indéterminée');
  });

  it('nomme indéterminée un type hors catalogue', async () => {
    const { prisma, reader } = build();
    prisma.traceSeeds = [{ id: 't1' }];
    prisma.layerSeeds = [
      {
        id: 'layer-1',
        fingerprintId: 't1',
        settings: {
          type: 'minutia',
          x: 10,
          y: 20,
          minutiaType: 'CROSSOVER',
        },
      },
    ];

    const data = await readCase(prisma, reader);

    expect(data.traces[0].minutiae[0].typeLabel).toBe('indéterminée');
  });
});

describe('PrismaCaseReportDataReader — appariements', () => {
  it('ne demande que les appariements des traces du dossier', async () => {
    const { prisma, reader } = build();
    prisma.traceSeeds = [{ id: 't1' }, { id: 't2', number: 2 }];

    await readCase(prisma, reader);

    expect(prisma.minutiaPairFindManyArgs[0]).toMatchObject({
      where: { traceId: { in: ['t1', 't2'] } },
    });
  });

  it('ne sert aucun appariement quand le dossier n’en porte pas', async () => {
    const { prisma, reader } = build();
    prisma.traceSeeds = [{ id: 't1' }];

    const data = await readCase(prisma, reader);

    expect(data.minutiaPairs).toEqual([]);
  });

  it('sert la paire en identifiants de calque, numérotée', async () => {
    const { prisma, reader } = build();
    prisma.traceSeeds = [{ id: 't1' }];
    prisma.printSeeds = [{ id: 'ref-1' }];
    prisma.layerSeeds = [
      {
        id: 'tm-1',
        fingerprintId: 't1',
        settings: { type: 'minutia', x: 10, y: 20 },
      },
      {
        id: 'rm-1',
        fingerprintId: 'ref-1',
        settings: { type: 'minutia', x: 110, y: 20 },
      },
    ];
    prisma.pairSeeds = [
      {
        id: 'pair-1',
        traceId: 't1',
        referencePrintId: 'ref-1',
        traceMinutiaLayerId: 'tm-1',
        referenceMinutiaLayerId: 'rm-1',
      },
    ];

    const data = await readCase(prisma, reader);

    expect(data.minutiaPairs).toEqual([
      {
        traceId: 't1',
        referencePrintId: 'ref-1',
        number: 1,
        traceMinutiaLayerId: 'tm-1',
        referenceMinutiaLayerId: 'rm-1',
      },
    ]);
  });

  it('numérote dans l’ordre de pose', async () => {
    const { prisma, reader } = build();
    prisma.traceSeeds = [{ id: 't1' }];
    prisma.printSeeds = [{ id: 'ref-1' }];
    prisma.layerSeeds = [
      {
        id: 'tm-1',
        fingerprintId: 't1',
        settings: { type: 'minutia', x: 1, y: 1 },
      },
      {
        id: 'tm-2',
        fingerprintId: 't1',
        settings: { type: 'minutia', x: 2, y: 2 },
      },
      {
        id: 'rm-1',
        fingerprintId: 'ref-1',
        settings: { type: 'minutia', x: 1, y: 1 },
      },
      {
        id: 'rm-2',
        fingerprintId: 'ref-1',
        settings: { type: 'minutia', x: 2, y: 2 },
      },
    ];
    prisma.pairSeeds = [
      {
        id: 'pair-tardive',
        traceId: 't1',
        referencePrintId: 'ref-1',
        traceMinutiaLayerId: 'tm-2',
        referenceMinutiaLayerId: 'rm-2',
        createdAt: new Date('2026-08-01T11:00:00.000Z'),
      },
      {
        id: 'pair-premiere',
        traceId: 't1',
        referencePrintId: 'ref-1',
        traceMinutiaLayerId: 'tm-1',
        referenceMinutiaLayerId: 'rm-1',
        createdAt: new Date('2026-08-01T10:00:00.000Z'),
      },
    ];

    const data = await readCase(prisma, reader);

    expect(
      data.minutiaPairs.map((pair) => [pair.traceMinutiaLayerId, pair.number]),
    ).toEqual([
      ['tm-1', 1],
      ['tm-2', 2],
    ]);
  });

  it('départage deux appariements posés à la même seconde par leur identifiant', async () => {
    const { prisma, reader } = build();
    prisma.traceSeeds = [{ id: 't1' }];
    prisma.printSeeds = [{ id: 'ref-1' }];
    prisma.layerSeeds = [
      {
        id: 'tm-1',
        fingerprintId: 't1',
        settings: { type: 'minutia', x: 1, y: 1 },
      },
      {
        id: 'tm-2',
        fingerprintId: 't1',
        settings: { type: 'minutia', x: 2, y: 2 },
      },
      {
        id: 'rm-1',
        fingerprintId: 'ref-1',
        settings: { type: 'minutia', x: 1, y: 1 },
      },
      {
        id: 'rm-2',
        fingerprintId: 'ref-1',
        settings: { type: 'minutia', x: 2, y: 2 },
      },
    ];
    prisma.pairSeeds = [
      {
        id: 'pair-b',
        traceId: 't1',
        referencePrintId: 'ref-1',
        traceMinutiaLayerId: 'tm-2',
        referenceMinutiaLayerId: 'rm-2',
        createdAt: AT,
      },
      {
        id: 'pair-a',
        traceId: 't1',
        referencePrintId: 'ref-1',
        traceMinutiaLayerId: 'tm-1',
        referenceMinutiaLayerId: 'rm-1',
        createdAt: AT,
      },
    ];

    const data = await readCase(prisma, reader);

    expect(
      data.minutiaPairs.map((pair) => [pair.traceMinutiaLayerId, pair.number]),
    ).toEqual([
      ['tm-1', 1],
      ['tm-2', 2],
    ]);
  });

  it('recommence la numérotation à chaque comparaison', async () => {
    const { prisma, reader } = build();
    prisma.traceSeeds = [{ id: 't1' }];
    prisma.printSeeds = [{ id: 'ref-1' }, { id: 'ref-2' }];
    prisma.layerSeeds = [
      {
        id: 'tm-1',
        fingerprintId: 't1',
        settings: { type: 'minutia', x: 1, y: 1 },
      },
      {
        id: 'tm-2',
        fingerprintId: 't1',
        settings: { type: 'minutia', x: 2, y: 2 },
      },
      {
        id: 'rm-1',
        fingerprintId: 'ref-1',
        settings: { type: 'minutia', x: 1, y: 1 },
      },
      {
        id: 'rm-2',
        fingerprintId: 'ref-2',
        settings: { type: 'minutia', x: 2, y: 2 },
      },
    ];
    prisma.pairSeeds = [
      {
        id: 'pair-1',
        traceId: 't1',
        referencePrintId: 'ref-1',
        traceMinutiaLayerId: 'tm-1',
        referenceMinutiaLayerId: 'rm-1',
        createdAt: new Date('2026-08-01T10:00:00.000Z'),
      },
      {
        id: 'pair-2',
        traceId: 't1',
        referencePrintId: 'ref-2',
        traceMinutiaLayerId: 'tm-2',
        referenceMinutiaLayerId: 'rm-2',
        createdAt: new Date('2026-08-01T11:00:00.000Z'),
      },
    ];

    const data = await readCase(prisma, reader);

    expect(
      data.minutiaPairs.map((pair) => [pair.referencePrintId, pair.number]),
    ).toEqual([
      ['ref-1', 1],
      ['ref-2', 1],
    ]);
  });

  it('écarte la paire dont la minutie de trace n’est plus servie', async () => {
    const { prisma, reader } = build();
    prisma.traceSeeds = [{ id: 't1' }];
    prisma.printSeeds = [{ id: 'ref-1' }];
    prisma.layerSeeds = [
      {
        id: 'rm-1',
        fingerprintId: 'ref-1',
        settings: { type: 'minutia', x: 110, y: 20 },
      },
    ];
    prisma.pairSeeds = [
      {
        id: 'pair-1',
        traceId: 't1',
        referencePrintId: 'ref-1',
        traceMinutiaLayerId: 'tm-disparue',
        referenceMinutiaLayerId: 'rm-1',
      },
    ];

    const data = await readCase(prisma, reader);

    expect(data.minutiaPairs).toEqual([]);
  });

  it('écarte la paire dont la minutie de référence n’est plus servie', async () => {
    const { prisma, reader } = build();
    prisma.traceSeeds = [{ id: 't1' }];
    prisma.printSeeds = [{ id: 'ref-1' }];
    prisma.layerSeeds = [
      {
        id: 'tm-1',
        fingerprintId: 't1',
        settings: { type: 'minutia', x: 10, y: 20 },
      },
    ];
    prisma.pairSeeds = [
      {
        id: 'pair-1',
        traceId: 't1',
        referencePrintId: 'ref-1',
        traceMinutiaLayerId: 'tm-1',
        referenceMinutiaLayerId: 'rm-disparue',
      },
    ];

    const data = await readCase(prisma, reader);

    expect(data.minutiaPairs).toEqual([]);
  });

  it('écarte la paire qui cite un calque qui n’est pas une minutie', async () => {
    const { prisma, reader } = build();
    prisma.traceSeeds = [{ id: 't1' }];
    prisma.printSeeds = [{ id: 'ref-1' }];
    prisma.layerSeeds = [
      {
        id: 'tm-1',
        fingerprintId: 't1',
        settings: { type: 'minutia', x: 10, y: 20 },
      },
      {
        id: 'crayon-1',
        fingerprintId: 'ref-1',
        settings: { type: 'pencil', points: [1, 2, 3, 4] },
      },
    ];
    prisma.pairSeeds = [
      {
        id: 'pair-1',
        traceId: 't1',
        referencePrintId: 'ref-1',
        traceMinutiaLayerId: 'tm-1',
        referenceMinutiaLayerId: 'crayon-1',
      },
    ];

    const data = await readCase(prisma, reader);

    expect(data.minutiaPairs).toEqual([]);
  });

  it('garde le numéro des paires servies quand une paire est écartée', async () => {
    const { prisma, reader } = build();
    prisma.traceSeeds = [{ id: 't1' }];
    prisma.printSeeds = [{ id: 'ref-1' }];
    prisma.layerSeeds = [
      {
        id: 'tm-2',
        fingerprintId: 't1',
        settings: { type: 'minutia', x: 2, y: 2 },
      },
      {
        id: 'rm-2',
        fingerprintId: 'ref-1',
        settings: { type: 'minutia', x: 2, y: 2 },
      },
    ];
    prisma.pairSeeds = [
      {
        id: 'pair-1',
        traceId: 't1',
        referencePrintId: 'ref-1',
        traceMinutiaLayerId: 'tm-disparue',
        referenceMinutiaLayerId: 'rm-disparue',
        createdAt: new Date('2026-08-01T10:00:00.000Z'),
      },
      {
        id: 'pair-2',
        traceId: 't1',
        referencePrintId: 'ref-1',
        traceMinutiaLayerId: 'tm-2',
        referenceMinutiaLayerId: 'rm-2',
        createdAt: new Date('2026-08-01T11:00:00.000Z'),
      },
    ];

    const data = await readCase(prisma, reader);

    expect(data.minutiaPairs.map((pair) => pair.number)).toEqual([2]);
  });
});

describe('PrismaCaseReportDataReader — destinataire', () => {
  it('sert l’autorité destinataire enregistrée sur le dossier', async () => {
    const { prisma, reader } = build();
    prisma.caseSeed = {
      recipientAuthority: 'Tribunal judiciaire de Paris',
      recipientAttentionQuality: 'Madame la juge d’instruction',
      recipientAttentionName: 'CHEVALIER Anne',
    };

    const data = await readCase(prisma, reader);

    expect(data.investigationCase.recipient).toEqual({
      authority: 'Tribunal judiciaire de Paris',
      attentionQuality: 'Madame la juge d’instruction',
      attentionName: 'CHEVALIER Anne',
    });
  });

  it('n’invente aucun destinataire quand le dossier n’en porte pas', async () => {
    const { prisma, reader } = build();

    const data = await readCase(prisma, reader);

    expect(data.investigationCase.recipient).toEqual({
      authority: null,
      attentionQuality: null,
      attentionName: null,
    });
  });
});

describe('PrismaCaseReportDataReader — en-tête judiciaire', () => {
  it('sert la demande d’intervention et le requérant qui l’a signée', async () => {
    const { prisma, reader } = build();
    prisma.caseSeed = {
      requestDate: new Date('2026-03-14T00:00:00.000Z'),
      requesterQuality: 'Brigadier-Chef de Police',
      requesterName: 'MARCHAND Claire',
      requesterService: '3e District de Police Judiciaire',
    };

    const data = await readCase(prisma, reader);

    expect(data.investigationCase).toMatchObject({
      requestDate: new Date('2026-03-14T00:00:00.000Z'),
      requesterQuality: 'Brigadier-Chef de Police',
      requesterName: 'MARCHAND Claire',
      requesterService: '3e District de Police Judiciaire',
    });
  });

  it('sert la nature des faits, leur lieu, leurs dates et la personne visée', async () => {
    const { prisma, reader } = build();
    prisma.caseSeed = {
      offenseNature: 'Vol par effraction',
      offenseLocation: '12 rue Léon Frot à Paris 11e',
      offenseDateFrom: new Date('2026-03-13T00:00:00.000Z'),
      offenseDateTo: new Date('2026-03-14T00:00:00.000Z'),
      interventionDate: new Date('2026-03-14T00:00:00.000Z'),
      caseAgainst: 'X',
    };

    const data = await readCase(prisma, reader);

    expect(data.investigationCase).toMatchObject({
      offenseNature: 'Vol par effraction',
      offenseLocation: '12 rue Léon Frot à Paris 11e',
      offenseDateFrom: new Date('2026-03-13T00:00:00.000Z'),
      offenseDateTo: new Date('2026-03-14T00:00:00.000Z'),
      interventionDate: new Date('2026-03-14T00:00:00.000Z'),
      caseAgainst: 'X',
    });
  });

  it('n’invente aucun en-tête quand le dossier n’en porte pas', async () => {
    const { prisma, reader } = build();

    const data = await readCase(prisma, reader);

    expect(data.investigationCase).toMatchObject({
      requestDate: null,
      requesterQuality: null,
      requesterName: null,
      requesterService: null,
      offenseNature: null,
      offenseLocation: null,
      offenseDateFrom: null,
      offenseDateTo: null,
      interventionDate: null,
      caseAgainst: null,
    });
  });
});
