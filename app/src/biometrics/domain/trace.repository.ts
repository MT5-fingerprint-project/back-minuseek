import { Trace } from './trace';

export interface TraceRepository {
  save(trace: Trace): Promise<void>;
  findById(id: string): Promise<Trace | null>;
}
