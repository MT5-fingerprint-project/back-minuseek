import { Injectable } from '@nestjs/common';
import { TenantContextService } from '../../../tenancy/application/tenant-context.service';
import { AdminPrismaService } from '../../../tenancy/infrastructure/persistence/admin-prisma.service';
import type {
  SealKind,
  SealRegistryPort,
  SealToRecord,
} from '../../../shared/domain/ports/seal-registry.port';

export class NoTenantForSealError extends Error {
  constructor() {
    super(
      "Un scellé se projette sous le laboratoire qui l'a écrit : aucun n'est posé dans le contexte",
    );
    this.name = 'NoTenantForSealError';
  }
}

export interface SealRecord {
  sha256: string;
  kind: SealKind;
  sealedAt: Date;
  anchoredAt: Date | null;
  caseId: string | null;
  reportType: string | null;
}

export interface ReportNeighbours {
  hasEarlier: boolean;
  hasLater: boolean;
}

@Injectable()
export class AdminSealRegistry implements SealRegistryPort {
  constructor(
    private readonly admin: AdminPrismaService,
    private readonly tenantContext: TenantContextService,
  ) {}

  async record(seal: SealToRecord): Promise<void> {
    const tenantSlug = this.tenantContext.getCurrentTenant();
    if (!tenantSlug) {
      throw new NoTenantForSealError();
    }
    await this.projectTenant(tenantSlug, [
      {
        sha256: seal.sha256,
        kind: seal.kind,
        chainSeq: seal.chainSeq,
        sealedAt: seal.sealedAt,
        anchoredAt: null,
        caseId: seal.caseId,
        reportType: seal.reportType ?? null,
      },
    ]);
  }

  async projectTenant(
    tenantSlug: string,
    seals: (SealToRecord & { anchoredAt: Date | null })[],
  ): Promise<void> {
    await this.admin.recordSeals(
      seals.map((seal) => ({
        tenantSlug,
        sha256: seal.sha256,
        kind: seal.kind,
        chainSeq: seal.chainSeq,
        sealedAt: seal.sealedAt,
        anchoredAt: seal.anchoredAt,
        caseId: seal.caseId,
        reportType: seal.reportType ?? null,
      })),
    );
  }

  async findSeal(
    tenantSlug: string,
    sha256: string,
  ): Promise<SealRecord | null> {
    const row = await this.admin.findSeal(tenantSlug, sha256);
    if (!row) return null;
    return {
      sha256: row.sha256,
      kind: row.kind,
      sealedAt: row.sealedAt,
      anchoredAt: row.anchoredAt,
      caseId: row.caseId,
      reportType: row.reportType,
    };
  }

  async reportNeighbours(
    tenantSlug: string,
    caseId: string,
    reportType: string,
    sealedAt: Date,
  ): Promise<ReportNeighbours> {
    const siblings = await this.admin.findReportSealDates(
      tenantSlug,
      caseId,
      reportType,
    );
    return {
      hasEarlier: siblings.some(
        (sibling) => sibling.sealedAt.getTime() < sealedAt.getTime(),
      ),
      hasLater: siblings.some(
        (sibling) => sibling.sealedAt.getTime() > sealedAt.getTime(),
      ),
    };
  }

  markAnchored(
    tenantSlug: string,
    coveredThroughSeq: bigint,
    anchoredAt: Date,
  ): Promise<number> {
    return this.admin.markSealsAnchored(
      tenantSlug,
      coveredThroughSeq,
      anchoredAt,
    );
  }
}
