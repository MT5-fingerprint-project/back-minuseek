import { TraceNumberAllocatorPort } from '../../application/ports/trace-number-allocator.port';

export class InMemoryTraceNumberAllocatorAdapter implements TraceNumberAllocatorPort {
  readonly counters = new Map<string, number>();

  allocate(caseId: string): Promise<number> {
    const allocated = (this.counters.get(caseId) ?? 0) + 1;
    this.counters.set(caseId, allocated);
    return Promise.resolve(allocated);
  }
}
