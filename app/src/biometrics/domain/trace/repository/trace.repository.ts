import { Trace } from '../entity/trace';

export interface TraceRepository {
  save(trace: Trace): Promise<void>;
  findById(id: string): Promise<Trace | null>;
  delete(id: string): Promise<void>;
}

export const TRACE_REPOSITORY = 'TraceRepository';
