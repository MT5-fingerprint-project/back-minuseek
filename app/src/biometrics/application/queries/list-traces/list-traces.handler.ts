import { Inject } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import {
  IMAGE_STORAGE,
  ImageStoragePort,
} from '../../ports/image-storage.port';
import { TraceReadModel } from './trace-read-model';
import { TRACE_READER, TraceReader } from './trace.reader';
import { ListTracesQuery } from './list-traces.query';

type TraceView = TraceReadModel & { url: string };

@QueryHandler(ListTracesQuery)
export class ListTracesHandler implements IQueryHandler<ListTracesQuery> {
  constructor(
    @Inject(TRACE_READER)
    private readonly reader: TraceReader,
    @Inject(IMAGE_STORAGE)
    private readonly storage: ImageStoragePort,
  ) {}

  async execute(query: ListTracesQuery): Promise<{ data: TraceView[] }> {
    const traces = await this.reader.findByCaseId(query.caseId);
    const data = await Promise.all(
      traces.map(async (trace) => ({
        ...trace,
        url: await this.storage.getUrl(trace.path),
      })),
    );
    return { data };
  }
}
