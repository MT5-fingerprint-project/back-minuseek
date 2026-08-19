import { Injectable } from '@nestjs/common';
import type { TimestampVerifierPort } from '../../application/ports/timestamp-verifier.port';
import { verifyTimestampOverData } from './rfc3161';

@Injectable()
export class Rfc3161TimestampVerifier implements TimestampVerifierPort {
  verifyOverData(tsrDer: Buffer, timestampedData: Buffer): Promise<boolean> {
    return verifyTimestampOverData(tsrDer, timestampedData);
  }
}
