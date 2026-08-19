import { createHash } from 'node:crypto';
import type {
  TimestampAuthorityPort,
  TimestampToken,
} from '../../application/ports/timestamp-authority.port';

/**
 * Faux horodateur des specs : le « TSR » est le condensat signé de rien, il
 * sert uniquement à porter un genTime déterministe et un octet-stream stable.
 */
export class InMemoryTsaAdapter implements TimestampAuthorityPort {
  readonly requested: string[] = [];
  failure: Error | null = null;

  constructor(
    private readonly genTime = new Date('2026-08-18T22:00:00.000Z'),
    readonly tsaUrl = 'in-memory://tsa',
  ) {}

  timestamp(sha256Hex: string): Promise<TimestampToken> {
    if (this.failure) {
      return Promise.reject(this.failure);
    }
    this.requested.push(sha256Hex);
    return Promise.resolve({
      tsaUrl: this.tsaUrl,
      genTime: this.genTime,
      tsrDer: createHash('sha256').update(sha256Hex).digest(),
    });
  }
}
