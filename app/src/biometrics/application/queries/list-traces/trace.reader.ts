import { TraceReadModel } from './trace-read-model';

export interface TraceReader {
  findByCaseId(caseId: string): Promise<TraceReadModel[]>;
}

export const TRACE_READER = 'TraceReader';
