export type SealKind =
  | 'TRACE'
  | 'REFERENCE_PRINT'
  | 'REPORT'
  | 'EXPORTED_IMAGE'
  | 'CONCORDANCE_VIDEO';

export interface SealToRecord {
  sha256: string;
  kind: SealKind;
  chainSeq: bigint;
  sealedAt: Date;
  caseId: string | null;
  reportType?: string | null;
}

export interface SealRegistryPort {
  record(seal: SealToRecord): Promise<void>;
}

export const SEAL_REGISTRY = 'SealRegistry';
