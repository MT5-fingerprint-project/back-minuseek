import { Trace } from '../../domain/trace';
import { TraceRepository } from '../../domain/trace.repository';

export class InMemoryTraceRepository implements TraceRepository {
  private readonly traces = new Map<string, Trace>();

  save(trace: Trace): Promise<void> {
    this.traces.set(trace.id, trace);
    return Promise.resolve();
  }

  findById(id: string): Promise<Trace | null> {
    return Promise.resolve(this.traces.get(id) ?? null);
  }
}
