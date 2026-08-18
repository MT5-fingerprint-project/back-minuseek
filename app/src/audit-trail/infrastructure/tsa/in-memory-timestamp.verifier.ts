import type { TimestampVerifierPort } from '../../application/ports/timestamp-verifier.port';

export class InMemoryTimestampVerifier implements TimestampVerifierPort {
  accept = true;
  readonly verified: { tsrDer: Buffer; timestampedData: Buffer }[] = [];

  verifyOverData(tsrDer: Buffer, timestampedData: Buffer): Promise<boolean> {
    this.verified.push({ tsrDer, timestampedData });
    return Promise.resolve(this.accept);
  }
}
