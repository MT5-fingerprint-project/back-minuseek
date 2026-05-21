import { TraceStatus } from '../trace-status';

export class InvalidTraceTransitionError extends Error {
  constructor(from: TraceStatus, attempted: string) {
    super(`Cannot ${attempted} a trace in status ${from}`);
    this.name = 'InvalidTraceTransitionError';
  }
}
