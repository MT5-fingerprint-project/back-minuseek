export const TIMESTAMP_AUTHORITY = 'TimestampAuthority';

export interface TimestampToken {
  tsaUrl: string;
  genTime: Date;
  tsrDer: Buffer;
}

export interface TimestampAuthorityPort {
  timestamp(sha256Hex: string): Promise<TimestampToken>;
}
