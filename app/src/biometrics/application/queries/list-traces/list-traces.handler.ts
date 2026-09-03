import { Inject } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import {
  IMAGE_STORAGE,
  ImageStoragePort,
} from '../../ports/image-storage.port';
import { TraceView } from './trace-read-model';
import { TRACE_READER, TraceReader } from './trace.reader';
import { ListTracesQuery } from './list-traces.query';

@QueryHandler(ListTracesQuery)
export class ListTracesHandler implements IQueryHandler<ListTracesQuery> {
  constructor(
    @Inject(TRACE_READER)
    private readonly reader: TraceReader,
    @Inject(IMAGE_STORAGE)
    private readonly storage: ImageStoragePort,
  ) {}

  async execute(query: ListTracesQuery): Promise<{ data: TraceView[] }> {
    const traces = await this.reader.findByCaseId(
      query.caseId,
      query.withdrawn,
    );
    const blind = query.blindVerifierUserId !== null;
    const data = await Promise.all(
      traces.map(async (trace) => {
        const [url, thumbUrl] = await Promise.all([
          this.storage.getUrl(trace.path),
          trace.thumbPath === null
            ? null
            : this.storage.getUrl(trace.thumbPath),
        ]);
        return {
          ...trace,
          status: blind ? null : trace.status,
          cote: blind ? null : trace.cote,
          identified: blind ? null : trace.identified,
          notIdentified: blind ? null : trace.notIdentified,
          url,
          thumbUrl,
        };
      }),
    );
    return { data };
  }
}
