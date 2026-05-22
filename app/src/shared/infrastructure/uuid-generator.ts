import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { IIdGenerator } from '../domain/ports/id-generator';

@Injectable()
export class UuidGenerator implements IIdGenerator {
  generate(): string {
    return randomUUID();
  }
}
