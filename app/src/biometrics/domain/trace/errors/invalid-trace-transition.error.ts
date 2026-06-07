import { TraceStatus } from '../value-objects/trace-status.vo';

export class InvalidTraceTransitionError extends Error {
  constructor(from: TraceStatus, attempted: string) {
    super(`Cannot ${attempted} a trace in status ${from.getValue()}`);
    this.name = 'InvalidTraceTransitionError';
  }
}
