export interface ChainAttestation {
  ok: boolean;
  eventsChecked: number;
  firstBrokenSeq: number | null;
  anchorsVerified: number;
  anchorsFailed: number;
}

export interface ChainAttestationPort {
  attest(): Promise<ChainAttestation>;
}

export const CHAIN_ATTESTATION = 'ChainAttestation';
