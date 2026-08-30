import { TraceReadModel } from '../../application/queries/list-traces/trace-read-model';
import type { TraceReader } from '../../application/queries/list-traces/trace.reader';

export class InMemoryTraceReader implements TraceReader {
  constructor(
    private readonly traces: TraceReadModel[] = [],
    private readonly knownCaseIds: string[] | null = null,
  ) {}

  findByCaseId(caseId: string, withdrawn = false): Promise<TraceReadModel[]> {
    if (!this.caseExists(caseId)) {
      return Promise.resolve([]);
    }
    return Promise.resolve(
      this.traces
        .filter(
          (trace) =>
            trace.caseId === caseId &&
            (trace.withdrawnAt !== null) === withdrawn,
        )
        .sort((left, right) => left.number - right.number),
    );
  }

  findById(id: string): Promise<TraceReadModel | null> {
    const trace = this.traces.find((candidate) => candidate.id === id);
    if (trace === undefined || !this.caseExists(trace.caseId)) {
      return Promise.resolve(null);
    }
    return Promise.resolve(trace);
  }

  private caseExists(caseId: string): boolean {
    return this.knownCaseIds === null || this.knownCaseIds.includes(caseId);
  }
}
