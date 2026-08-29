import { AuditEventTypeEnum } from '../../../shared/domain/audit/audit-event-type.vo';
import { TenantContextService } from '../../../tenancy/application/tenant-context.service';
import type { TenantRegistryService } from '../../../tenancy/application/tenant-registry.service';
import type {
  AnchorPoint,
  SealingEvent,
} from '../../application/seals/seal-projection';
import type { AdminSealRegistry } from '../persistence/admin-seal-registry';
import type { PrismaSealSourceReader } from '../persistence/prisma-seal-source.reader';
import { TenantSealProjectionRunner } from './tenant-seal-projection.runner';

const AT = new Date('2026-03-16T17:03:00.000Z');
const ANCHORED_AT = new Date('2026-03-17T02:00:00.000Z');

function event(
  seq: bigint,
  eventType: AuditEventTypeEnum,
  payload: Record<string, unknown>,
): SealingEvent {
  return { seq, eventType, occurredAt: AT, caseId: 'case-1', payload };
}

function build(options: {
  events?: SealingEvent[];
  anchors?: AnchorPoint[];
  tenants?: string[];
}) {
  const events = options.events ?? [];
  const projected: {
    tenantSlug: string;
    sha256: string;
    anchoredAt: Date | null;
  }[] = [];

  const PAGE = 2;
  const source = {
    readSealingEvents: (afterSeq: bigint, take: number) =>
      Promise.resolve(
        events
          .filter((one) => one.seq > afterSeq)
          .slice(0, Math.min(take, PAGE)),
      ),
    readAnchorPoints: () => Promise.resolve(options.anchors ?? []),
  } as unknown as PrismaSealSourceReader;

  const registry = {
    projectTenant: (
      tenantSlug: string,
      seals: { sha256: string; anchoredAt: Date | null }[],
    ) => {
      for (const seal of seals) {
        const known = projected.some(
          (one) => one.tenantSlug === tenantSlug && one.sha256 === seal.sha256,
        );
        if (!known) {
          projected.push({
            tenantSlug,
            sha256: seal.sha256,
            anchoredAt: seal.anchoredAt,
          });
        }
      }
      return Promise.resolve();
    },
  } as unknown as AdminSealRegistry;

  const slugs = options.tenants ?? ['demo'];
  const tenantRegistry = {
    findBySlug: (slug: string) =>
      Promise.resolve(slugs.includes(slug) ? { slug } : null),
    list: () => Promise.resolve(slugs.map((slug) => ({ slug }))),
  } as unknown as TenantRegistryService;

  return {
    projected,
    runner: new TenantSealProjectionRunner(
      tenantRegistry,
      new TenantContextService(),
      source,
      registry,
    ),
  };
}

describe('TenantSealProjectionRunner', () => {
  it('reconstruit les scellés d’un laboratoire depuis son registre', async () => {
    const { runner, projected } = build({
      events: [
        event(1n, AuditEventTypeEnum.TRACE_UPLOADED, {
          fileSha256: 'a'.repeat(64),
        }),
        event(2n, AuditEventTypeEnum.REFERENCE_PRINT_UPLOADED, {
          fileSha256: 'b'.repeat(64),
        }),
        event(3n, AuditEventTypeEnum.REPORT_GENERATED, {
          type: 'TECHNICAL',
          sha256: 'c'.repeat(64),
        }),
      ],
    });

    const [outcome] = await runner.sync('demo');

    expect(outcome).toEqual({ tenant: 'demo', status: 'synced', projected: 3 });
    expect(projected).toHaveLength(3);
  });

  it('balaie le registre par lots jusqu’au bout', async () => {
    const { runner, projected } = build({
      events: [
        event(1n, AuditEventTypeEnum.TRACE_UPLOADED, {
          fileSha256: 'a'.repeat(64),
        }),
        event(2n, AuditEventTypeEnum.TRACE_UPLOADED, {
          fileSha256: 'b'.repeat(64),
        }),
        event(3n, AuditEventTypeEnum.TRACE_UPLOADED, {
          fileSha256: 'c'.repeat(64),
        }),
        event(4n, AuditEventTypeEnum.TRACE_UPLOADED, {
          fileSha256: 'd'.repeat(64),
        }),
        event(5n, AuditEventTypeEnum.TRACE_UPLOADED, {
          fileSha256: 'e'.repeat(64),
        }),
      ],
    });

    const [outcome] = await runner.sync('demo');

    expect(outcome.projected).toBe(5);
    expect(projected).toHaveLength(5);
  });

  it('ignore les actes qui ne scellent aucun fichier', async () => {
    const { runner, projected } = build({
      events: [
        event(1n, AuditEventTypeEnum.CASE_OPENED, { caseNumber: '3455' }),
        event(2n, AuditEventTypeEnum.TRACE_UPLOADED, {
          fileSha256: 'a'.repeat(64),
        }),
      ],
    });

    await runner.sync('demo');

    expect(projected).toHaveLength(1);
  });

  it('est strictement idempotent : la seconde passe ne crée rien', async () => {
    const { runner, projected } = build({
      events: [
        event(1n, AuditEventTypeEnum.TRACE_UPLOADED, {
          fileSha256: 'a'.repeat(64),
        }),
      ],
    });

    await runner.sync('demo');
    await runner.sync('demo');

    expect(projected).toHaveLength(1);
  });

  it('date chaque scellé de la première ancre qui le couvre', async () => {
    const { runner, projected } = build({
      events: [
        event(30n, AuditEventTypeEnum.TRACE_UPLOADED, {
          fileSha256: 'a'.repeat(64),
        }),
      ],
      anchors: [
        { headSeq: 10n, anchoredAt: new Date('2026-03-16T10:00:00.000Z') },
        { headSeq: 40n, anchoredAt: ANCHORED_AT },
        { headSeq: 90n, anchoredAt: new Date('2026-03-18T02:00:00.000Z') },
      ],
    });

    await runner.sync('demo');

    expect(projected[0].anchoredAt).toEqual(ANCHORED_AT);
  });

  it('balaie tous les laboratoires quand aucun n’est nommé', async () => {
    const { runner, projected } = build({
      tenants: ['demo', 'srpts-paris'],
      events: [
        event(1n, AuditEventTypeEnum.TRACE_UPLOADED, {
          fileSha256: 'a'.repeat(64),
        }),
      ],
    });

    const outcomes = await runner.sync();

    expect(outcomes.map((one) => one.tenant)).toEqual(['demo', 'srpts-paris']);
    expect(projected.map((one) => one.tenantSlug)).toEqual([
      'demo',
      'srpts-paris',
    ]);
  });

  it('signale un laboratoire inconnu du registre sans balayer les autres', async () => {
    const { runner, projected } = build({ events: [] });

    const [outcome] = await runner.sync('inexistant');

    expect(outcome).toMatchObject({
      tenant: 'inexistant',
      status: 'failed',
      error: 'tenant inconnu du registre',
    });
    expect(projected).toEqual([]);
  });
});
