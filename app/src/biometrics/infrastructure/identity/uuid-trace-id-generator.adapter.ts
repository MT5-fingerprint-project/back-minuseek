import { randomUUID } from 'node:crypto';
import { TraceIdGenerator } from '../../application/ports/trace-id-generator.port';

export class UuidTraceIdGenerator implements TraceIdGenerator {
  nextId(): string {
    return randomUUID();
  }
}
