import type { QueryBus } from '@nestjs/cqrs';
import { TenantContextService } from '../../../tenancy/application/tenant-context.service';
import type { TenantRegistryService } from '../../../tenancy/application/tenant-registry.service';
import {
  StructuredLogger,
  type LogSeverity,
} from '../../../shared/infrastructure/logging/structured-logger';
import type { ChainVerificationReport } from '../../application/queries/verify-chain/chain-verification-report';
import { TenantChainVerificationRunner } from './tenant-chain-verification.runner';

class CapturingLogger extends StructuredLogger {
  readonly lines: {
    severity: LogSeverity;
    message: string;
    fields: Record<string, unknown>;
  }[] = [];

  override log(
    severity: LogSeverity,
    message: string,
    fields: Record<string, unknown> = {},
  ): void {
    this.lines.push({ severity, message, fields });
  }
}

const INTACT: ChainVerificationReport = {
  ok: true,
  eventsChecked: 3,
  anchors: { verified: 1, failed: 0 },
};

const BROKEN: ChainVerificationReport = {
  ok: false,
  eventsChecked: 1,
  firstBrokenSeq: 2,
  anchors: { verified: 0, failed: 0 },
};

function registryOf(slugs: string[]): TenantRegistryService {
  return {
    list: () => Promise.resolve(slugs.map((slug) => ({ slug }))),
    findBySlug: (slug: string) =>
      Promise.resolve(slugs.includes(slug) ? { slug } : null),
  } as unknown as TenantRegistryService;
}

function queryBusOf(
  reportBySlug: (slug: string) => ChainVerificationReport | Error,
  tenantContext: TenantContextService,
): QueryBus {
  return {
    execute: () => {
      const slug = tenantContext.getCurrentTenant() ?? '';
      const report = reportBySlug(slug);
      return report instanceof Error
        ? Promise.reject(report)
        : Promise.resolve(report);
    },
  } as unknown as QueryBus;
}

describe('TenantChainVerificationRunner', () => {
  const tenantContext = new TenantContextService();
  let logger: CapturingLogger;

  beforeEach(() => {
    logger = new CapturingLogger();
  });

  function runnerFor(
    slugs: string[],
    reportBySlug: (slug: string) => ChainVerificationReport | Error,
  ) {
    return new TenantChainVerificationRunner(
      registryOf(slugs),
      tenantContext,
      queryBusOf(reportBySlug, tenantContext),
      logger,
    );
  }

  it('vérifie chaque tenant du registre et loggue une ligne INFO par chaîne intègre', async () => {
    const runner = runnerFor(['labo-lyon', 'labo-paris'], () => INTACT);

    const summary = await runner.verify();

    expect(summary.ok).toBe(true);
    expect(summary.tenantsChecked).toBe(2);
    expect(summary.brokenTenants).toEqual([]);
    expect(logger.lines.map((line) => line.severity)).toEqual(['INFO', 'INFO']);
    expect(logger.lines[0].fields).toMatchObject({
      tenant: 'labo-lyon',
      ok: true,
      eventsChecked: 3,
      anchorsVerified: 1,
    });
  });

  it('loggue en ERROR le tenant rompu et le remonte dans l agrégat', async () => {
    const runner = runnerFor(['labo-lyon', 'labo-paris'], (slug) =>
      slug === 'labo-paris' ? BROKEN : INTACT,
    );

    const summary = await runner.verify();

    expect(summary.ok).toBe(false);
    expect(summary.brokenTenants).toEqual(['labo-paris']);
    const broken = logger.lines[1];
    expect(broken.severity).toBe('ERROR');
    expect(broken.fields).toMatchObject({
      tenant: 'labo-paris',
      firstBrokenSeq: 2,
    });
  });

  it("n'arrête pas la boucle quand un tenant est injoignable", async () => {
    const runner = runnerFor(['labo-lyon', 'labo-paris'], (slug) =>
      slug === 'labo-lyon' ? new Error('base injoignable') : INTACT,
    );

    const summary = await runner.verify();

    expect(summary.tenantsChecked).toBe(2);
    expect(summary.brokenTenants).toEqual(['labo-lyon']);
    expect(logger.lines[0].fields).toMatchObject({
      tenant: 'labo-lyon',
      error: 'base injoignable',
    });
    expect(logger.lines[1].severity).toBe('INFO');
  });

  it('refuse un tenant absent du registre', async () => {
    const runner = runnerFor(['labo-lyon'], () => INTACT);

    const summary = await runner.verify('inconnu');

    expect(summary.ok).toBe(false);
    expect(summary.verifications[0].error).toBe('tenant inconnu du registre');
  });
});
