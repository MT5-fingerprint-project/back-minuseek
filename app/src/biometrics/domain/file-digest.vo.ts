import { createHash } from 'node:crypto';

const SHA256_HEX = /^[0-9a-f]{64}$/;

export class InvalidFileDigestError extends Error {
  constructor(value: string) {
    super(
      `"${value}" n'est pas un SHA-256 hexadécimal minuscule de 64 caractères`,
    );
  }
}

export class FileDigest {
  private constructor(private readonly value: string) {}

  static ofBuffer(bytes: Buffer): FileDigest {
    return new FileDigest(createHash('sha256').update(bytes).digest('hex'));
  }

  static from(raw: string): FileDigest {
    if (!SHA256_HEX.test(raw)) {
      throw new InvalidFileDigestError(raw);
    }
    return new FileDigest(raw);
  }

  getValue(): string {
    return this.value;
  }

  equals(other: FileDigest): boolean {
    return this.value === other.value;
  }
}
