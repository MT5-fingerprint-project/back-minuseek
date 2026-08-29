import { TenantContextService } from '../../../tenancy/application/tenant-context.service';
import type { AdminPrismaService } from '../../../tenancy/infrastructure/persistence/admin-prisma.service';
import { AdminSealRegistry, NoTenantForSealError } from './admin-seal-registry';

const AT = new Date('2026-03-16T17:03:00.000Z');
const DIGEST = 'a'.repeat(64);

interface Row {
  tenantSlug: string;
  sha256: string;
  kind: 'TRACE' | 'REFERENCE_PRINT' | 'REPORT';
  chainSeq: bigint;
  sealedAt: Date;
  anchoredAt: Date | null;
  caseId: string | null;
  reportType: string | null;
}

function fakeAdmin(rows: Row[] = []) {
  return {
    rows,
    recordSeals: (seals: Row[]) => {
      for (const seal of seals) {
        const known = rows.some(
          (row) =>
            row.tenantSlug === seal.tenantSlug && row.sha256 === seal.sha256,
        );
        if (!known) rows.push(seal);
      }
      return Promise.resolve();
    },
    findSeal: (tenantSlug: string, sha256: string) =>
      Promise.resolve(
        rows.find(
          (row) => row.tenantSlug === tenantSlug && row.sha256 === sha256,
        ) ?? null,
      ),
    findReportSealDates: (
      tenantSlug: string,
      caseId: string,
      reportType: string,
    ) =>
      Promise.resolve(
        rows
          .filter(
            (row) =>
              row.tenantSlug === tenantSlug &&
              row.caseId === caseId &&
              row.reportType === reportType &&
              row.kind === 'REPORT',
          )
          .map((row) => ({ sealedAt: row.sealedAt })),
      ),
    markSealsAnchored: (
      tenantSlug: string,
      coveredThroughSeq: bigint,
      anchoredAt: Date,
    ) => {
      let count = 0;
      for (const row of rows) {
        if (
          row.tenantSlug === tenantSlug &&
          row.anchoredAt === null &&
          row.chainSeq <= coveredThroughSeq
        ) {
          row.anchoredAt = anchoredAt;
          count += 1;
        }
      }
      return Promise.resolve(count);
    },
  };
}

function build(rows: Row[] = []) {
  const admin = fakeAdmin(rows);
  const context = new TenantContextService();
  return {
    admin,
    context,
    registry: new AdminSealRegistry(
      admin as unknown as AdminPrismaService,
      context,
    ),
  };
}

describe('AdminSealRegistry — projection', () => {
  it('refuse de projeter hors contexte de laboratoire', async () => {
    const { registry } = build();

    await expect(
      registry.record({
        sha256: DIGEST,
        kind: 'TRACE',
        chainSeq: 5n,
        sealedAt: AT,
        caseId: 'case-1',
      }),
    ).rejects.toThrow(NoTenantForSealError);
  });

  it('projette le scellé sous le laboratoire courant', async () => {
    const { registry, context, admin } = build();

    await context.run({ slug: 'demo' }, () =>
      registry.record({
        sha256: DIGEST,
        kind: 'TRACE',
        chainSeq: 5n,
        sealedAt: AT,
        caseId: 'case-1',
      }),
    );

    expect(admin.rows).toEqual([
      {
        tenantSlug: 'demo',
        sha256: DIGEST,
        kind: 'TRACE',
        chainSeq: 5n,
        sealedAt: AT,
        anchoredAt: null,
        caseId: 'case-1',
        reportType: null,
      },
    ]);
  });

  it('ne crée qu’une ligne quand le même fichier est redéposé', async () => {
    const { registry, context, admin } = build();
    const seal = {
      sha256: DIGEST,
      kind: 'TRACE' as const,
      chainSeq: 5n,
      sealedAt: AT,
      caseId: 'case-1',
    };

    await context.run({ slug: 'demo' }, async () => {
      await registry.record(seal);
      await registry.record({ ...seal, chainSeq: 9n });
    });

    expect(admin.rows).toHaveLength(1);
    expect(admin.rows[0].chainSeq).toBe(5n);
  });

  it('crée deux lignes pour la même empreinte dans deux laboratoires', async () => {
    const { registry, context, admin } = build();
    const seal = {
      sha256: DIGEST,
      kind: 'TRACE' as const,
      chainSeq: 5n,
      sealedAt: AT,
      caseId: 'case-1',
    };

    await context.run({ slug: 'demo' }, () => registry.record(seal));
    await context.run({ slug: 'srpts-paris' }, () => registry.record(seal));

    expect(admin.rows.map((row) => row.tenantSlug)).toEqual([
      'demo',
      'srpts-paris',
    ]);
  });

  it('retient la nature du document pour un rapport', async () => {
    const { registry, context, admin } = build();

    await context.run({ slug: 'demo' }, () =>
      registry.record({
        sha256: DIGEST,
        kind: 'REPORT',
        chainSeq: 5n,
        sealedAt: AT,
        caseId: 'case-1',
        reportType: 'TECHNICAL',
      }),
    );

    expect(admin.rows[0].reportType).toBe('TECHNICAL');
  });
});

describe('AdminSealRegistry — lecture publique', () => {
  function report(overrides: Partial<Row>): Row {
    return {
      tenantSlug: 'demo',
      sha256: DIGEST,
      kind: 'REPORT',
      chainSeq: 5n,
      sealedAt: AT,
      anchoredAt: null,
      caseId: 'case-1',
      reportType: 'TECHNICAL',
      ...overrides,
    };
  }

  it('retrouve un scellé par son empreinte', async () => {
    const { registry } = build([report({})]);

    await expect(registry.findSeal('demo', DIGEST)).resolves.toMatchObject({
      kind: 'REPORT',
      sealedAt: AT,
    });
  });

  it('ne trouve rien pour un autre laboratoire', async () => {
    const { registry } = build([report({})]);

    await expect(registry.findSeal('srpts-paris', DIGEST)).resolves.toBeNull();
  });

  it('signale les deux voisins d’un rapport du même dossier', async () => {
    const { registry } = build([
      report({
        sha256: 'b'.repeat(64),
        sealedAt: new Date('2026-03-15T10:00:00.000Z'),
      }),
      report({}),
      report({
        sha256: 'c'.repeat(64),
        sealedAt: new Date('2026-03-18T10:00:00.000Z'),
      }),
    ]);

    await expect(
      registry.reportNeighbours('demo', 'case-1', 'TECHNICAL', AT),
    ).resolves.toEqual({ hasEarlier: true, hasLater: true });
  });

  it('ne signale qu’un antérieur quand le rapport est le dernier édité', async () => {
    const { registry } = build([
      report({
        sha256: 'b'.repeat(64),
        sealedAt: new Date('2026-03-15T10:00:00.000Z'),
      }),
      report({}),
    ]);

    await expect(
      registry.reportNeighbours('demo', 'case-1', 'TECHNICAL', AT),
    ).resolves.toEqual({ hasEarlier: true, hasLater: false });
  });

  it('ne signale qu’un ultérieur quand le rapport est le premier édité', async () => {
    const { registry } = build([
      report({}),
      report({
        sha256: 'c'.repeat(64),
        sealedAt: new Date('2026-03-18T10:00:00.000Z'),
      }),
    ]);

    await expect(
      registry.reportNeighbours('demo', 'case-1', 'TECHNICAL', AT),
    ).resolves.toEqual({ hasEarlier: false, hasLater: true });
  });

  it('ne compte pas un document d’une autre nature comme un voisin', async () => {
    const { registry } = build([
      report({}),
      report({
        sha256: 'b'.repeat(64),
        reportType: 'TRACEABILITY',
        sealedAt: new Date('2026-03-18T10:00:00.000Z'),
      }),
    ]);

    await expect(
      registry.reportNeighbours('demo', 'case-1', 'TECHNICAL', AT),
    ).resolves.toEqual({ hasEarlier: false, hasLater: false });
  });

  it('ne compte pas un document d’un autre dossier comme un voisin', async () => {
    const { registry } = build([
      report({}),
      report({
        sha256: 'b'.repeat(64),
        caseId: 'case-2',
        sealedAt: new Date('2026-03-18T10:00:00.000Z'),
      }),
    ]);

    await expect(
      registry.reportNeighbours('demo', 'case-1', 'TECHNICAL', AT),
    ).resolves.toEqual({ hasEarlier: false, hasLater: false });
  });
});

describe('AdminSealRegistry — marquage d’ancrage', () => {
  it('marque d’un coup tous les scellés couverts, et eux seuls', async () => {
    const rows: Row[] = [
      {
        tenantSlug: 'demo',
        sha256: 'a'.repeat(64),
        kind: 'TRACE',
        chainSeq: 10n,
        sealedAt: AT,
        anchoredAt: null,
        caseId: 'case-1',
        reportType: null,
      },
      {
        tenantSlug: 'demo',
        sha256: 'b'.repeat(64),
        kind: 'TRACE',
        chainSeq: 50n,
        sealedAt: AT,
        anchoredAt: null,
        caseId: 'case-1',
        reportType: null,
      },
      {
        tenantSlug: 'srpts-paris',
        sha256: 'c'.repeat(64),
        kind: 'TRACE',
        chainSeq: 10n,
        sealedAt: AT,
        anchoredAt: null,
        caseId: 'case-1',
        reportType: null,
      },
    ];
    const { registry } = build(rows);
    const anchoredAt = new Date('2026-03-17T02:00:00.000Z');

    const marked = await registry.markAnchored('demo', 40n, anchoredAt);

    expect(marked).toBe(1);
    expect(rows.map((row) => row.anchoredAt)).toEqual([anchoredAt, null, null]);
  });

  it('ne réécrit pas la date d’un scellé déjà horodaté', async () => {
    const first = new Date('2026-03-17T02:00:00.000Z');
    const rows: Row[] = [
      {
        tenantSlug: 'demo',
        sha256: 'a'.repeat(64),
        kind: 'TRACE',
        chainSeq: 10n,
        sealedAt: AT,
        anchoredAt: first,
        caseId: 'case-1',
        reportType: null,
      },
    ];
    const { registry } = build(rows);

    await registry.markAnchored(
      'demo',
      90n,
      new Date('2026-03-18T02:00:00.000Z'),
    );

    expect(rows[0].anchoredAt).toEqual(first);
  });
});
