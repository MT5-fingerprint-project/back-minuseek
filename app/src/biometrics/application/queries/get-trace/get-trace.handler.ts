import { Inject } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import {
  IMAGE_STORAGE,
  ImageStoragePort,
} from '../../ports/image-storage.port';
import {
  TraceDetailView,
  TraceLocationPhotoView,
} from '../list-traces/trace-read-model';
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

  async execute(query: GetTraceQuery): Promise<TraceDetailView | null> {
    const trace = await this.reader.findById(query.traceId);
    if (trace === null) {
      return null;
    }
    const blind = query.blindVerifierUserId !== null;
    const { locationPhoto, ...columns } = trace;
    let photo: TraceLocationPhotoView | null = null;
    if (locationPhoto !== null) {
      photo = {
        id: locationPhoto.id,
        url: await this.storage.getUrl(locationPhoto.path),
        sha256: locationPhoto.sha256,
        sealedAt: locationPhoto.sealedAt,
      };
    }
    return {
      ...columns,
      status: blind ? null : trace.status,
      cote: blind ? null : trace.cote,
      identified: blind ? null : trace.identified,
      url: await this.storage.getUrl(trace.path),
      locationPhoto: photo,
    };
  }
}
