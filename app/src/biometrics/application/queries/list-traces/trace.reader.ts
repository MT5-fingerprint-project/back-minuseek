import { TraceDetailReadModel, TraceReadModel } from './trace-read-model';

export interface TraceReader {
  findByCaseId(caseId: string, withdrawn: boolean): Promise<TraceReadModel[]>;
  findById(id: string): Promise<TraceDetailReadModel | null>;
}

export const TRACE_READER = 'TraceReader';
