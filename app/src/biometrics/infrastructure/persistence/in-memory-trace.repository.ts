import { Trace } from '../../domain/trace/entity/trace';
import { TraceRepository } from '../../domain/trace/repository/trace.repository';

export class InMemoryTraceRepository implements TraceRepository {
  readonly store = new Map<string, Trace>();

  save(trace: Trace): Promise<void> {
    this.store.set(trace.id, trace);
    return Promise.resolve();
  }

  findById(id: string): Promise<Trace | null> {
    return Promise.resolve(this.store.get(id) ?? null);
  }

  delete(id: string): Promise<void> {
    this.store.delete(id);
    return Promise.resolve();
  }
}
