import type { SealKind } from '../../../shared/domain/ports/seal-registry.port';

export interface PublicSealRecord {
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

export interface PublicSealReader {
  findLaboratoryName(tenantSlug: string): Promise<string | null>;
  findSeal(
    tenantSlug: string,
    sha256: string,
  ): Promise<PublicSealRecord | null>;
  reportNeighbours(
    tenantSlug: string,
    caseId: string,
    reportType: string,
    sealedAt: Date,
  ): Promise<ReportNeighbours>;
}

export const PUBLIC_SEAL_READER = 'PublicSealReader';
