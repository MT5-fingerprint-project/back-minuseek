import type { SealKind } from '../../../../shared/domain/ports/seal-registry.port';

export interface PublicSealReadModel {
  known: true;
  kind: SealKind;
  laboratory: string;
  sealedAt: Date;
  anchoredAt: Date | null;
  precededByEarlierReport: boolean;
  supersededByNewerReport: boolean;
}
