import { Injectable, Optional } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import type {
  TimestampAuthorityPort,
  TimestampToken,
} from '../../application/ports/timestamp-authority.port';
import {
  buildTimestampRequest,
  readTstInfo,
  verifyTimestampMatches,
} from './rfc3161';
import { TimestampAuthorityError } from './timestamp-authority.error';

const REQUEST_CONTENT_TYPE = 'application/timestamp-query';
const NONCE_BYTES = 16;
const DEFAULT_TIMEOUT_MS = 10_000;

@Injectable()
export class Rfc3161TsaAdapter implements TimestampAuthorityPort {
  private readonly timeoutMs = Number(
    process.env.TSA_TIMEOUT_MS ?? DEFAULT_TIMEOUT_MS,
  );

  constructor(
    @Optional()
    private readonly newNonce: () => Buffer = () => randomBytes(NONCE_BYTES),
  ) {}

  private get tsaUrl(): string {
    return requireEnv('TSA_URL');
  }

  async timestamp(sha256Hex: string): Promise<TimestampToken> {
    const digest = Buffer.from(sha256Hex, 'hex');
    if (digest.length !== 32) {
      throw new TimestampAuthorityError(
        'le condensat à horodater doit être un SHA-256 hexadécimal',
      );
    }

    const nonce = this.newNonce();
    const tsrDer = await this.ask(buildTimestampRequest(digest, nonce));
    const tstInfo = readTstInfo(tsrDer);
    verifyTimestampMatches(tstInfo, digest, nonce);

    return { tsaUrl: this.tsaUrl, genTime: tstInfo.genTime, tsrDer };
  }

  private async ask(requestDer: Buffer): Promise<Buffer> {
    let response: Response;
    try {
      response = await fetch(this.tsaUrl, {
        method: 'POST',
        headers: { 'Content-Type': REQUEST_CONTENT_TYPE },
        body: new Uint8Array(requestDer),
        signal: AbortSignal.timeout(this.timeoutMs),
      });
    } catch (error) {
      throw new TimestampAuthorityError(
        `TSA ${this.tsaUrl} injoignable (${error instanceof Error ? error.message : String(error)})`,
      );
    }

    if (!response.ok) {
      throw new TimestampAuthorityError(
        `TSA ${this.tsaUrl} a répondu ${response.status}`,
      );
    }
    return Buffer.from(await response.arrayBuffer());
  }
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Variable d'environnement manquante: ${name}`);
  }
  return value;
}
