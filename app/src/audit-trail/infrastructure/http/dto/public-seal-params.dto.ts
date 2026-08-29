import { Transform } from 'class-transformer';
import { Matches } from 'class-validator';

const SLUG = /^[a-z0-9-]{1,64}$/;
const SHA256_HEX = /^[0-9a-fA-F]{64}$/;

export class PublicSealParamsDto {
  @Matches(SLUG)
  slug!: string;

  @Transform(({ value }): unknown =>
    typeof value === 'string' ? value.toLowerCase() : value,
  )
  @Matches(SHA256_HEX)
  sha256!: string;
}
