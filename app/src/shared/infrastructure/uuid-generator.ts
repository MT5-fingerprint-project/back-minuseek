import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { IdGenerator } from '../domain/ports/id-generator';

@Injectable()
export class UuidGenerator implements IdGenerator {
  generate(): string {
    return randomUUID();
  }
}
