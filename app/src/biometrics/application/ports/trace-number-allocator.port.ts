export const TRACE_NUMBER_ALLOCATOR = 'TraceNumberAllocator';

export interface TraceNumberAllocatorPort {
  allocate(caseId: string): Promise<number>;
}
