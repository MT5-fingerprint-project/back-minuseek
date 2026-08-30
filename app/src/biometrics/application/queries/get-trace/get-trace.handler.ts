import { Inject } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import {
  IMAGE_STORAGE,
  ImageStoragePort,
} from '../../ports/image-storage.port';
import { TraceView } from '../list-traces/trace-read-model';
import { TRACE_READER, TraceReader } from '../list-traces/trace.reader';
import { GetTraceQuery } from './get-trace.query';

@QueryHandler(GetTraceQuery)
export class GetTraceHandler implements IQueryHandler<GetTraceQuery> {
  constructor(
    @Inject(TRACE_READER)
    private readonly reader: TraceReader,
    @Inject(IMAGE_STORAGE)
    private readonly storage: ImageStoragePort,
  ) {}

  async execute(query: GetTraceQuery): Promise<TraceView | null> {
    const trace = await this.reader.findById(query.traceId);
    if (trace === null) {
      return null;
    }
    const blind = query.blindVerifierUserId !== null;
    return {
      ...trace,
      status: blind ? null : trace.status,
      identified: blind ? null : trace.identified,
      url: await this.storage.getUrl(trace.path),
    };
  }
}
