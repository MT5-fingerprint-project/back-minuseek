import { TraceReadModel } from './trace-read-model';

export interface TraceReader {
  findByCaseId(caseId: string, withdrawn: boolean): Promise<TraceReadModel[]>;
  findById(id: string): Promise<TraceReadModel | null>;
}

export const TRACE_READER = 'TraceReader';
