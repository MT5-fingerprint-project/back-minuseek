export const TIMESTAMP_VERIFIER = 'TimestampVerifier';

export interface TimestampVerifierPort {
  /** Le TSR signe-t-il bien ces octets, et son messageImprint les couvre-t-il ? */
  verifyOverData(tsrDer: Buffer, timestampedData: Buffer): Promise<boolean>;
}
