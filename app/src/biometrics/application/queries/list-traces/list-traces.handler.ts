import { Inject } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { TraceReadModel } from './trace-read-model';
import { TRACE_READER, TraceReader } from './trace.reader';
import { ListTracesQuery } from './list-traces.query';

@QueryHandler(ListTracesQuery)
export class ListTracesHandler implements IQueryHandler<ListTracesQuery> {
  constructor(
    @Inject(TRACE_READER)
    private readonly reader: TraceReader,
  ) {}

  async execute(query: ListTracesQuery): Promise<{ data: TraceReadModel[] }> {
    const data = await this.reader.findByCaseId(query.caseId);
    return { data };
  }
}
