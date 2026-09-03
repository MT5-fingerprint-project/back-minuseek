import { Inject } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import {
  IMAGE_STORAGE,
  ImageStoragePort,
} from '../../ports/image-storage.port';
import {
  TraceDetailView,
  TraceLocationPhotoReadModel,
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
    // Une signature V4 keyless coûte un aller-retour IAM : les adresses d'une
    // fiche se signent ensemble, jamais l'une après l'autre.
    const [url, thumbUrl, photo] = await Promise.all([
      this.storage.getUrl(trace.path),
      this.signedUrlOrNull(trace.thumbPath),
      this.viewOfLocationPhoto(locationPhoto),
    ]);
    return {
      ...columns,
      status: blind ? null : trace.status,
      cote: blind ? null : trace.cote,
      identified: blind ? null : trace.identified,
      notIdentified: blind ? null : trace.notIdentified,
      url,
      thumbUrl,
      locationPhoto: photo,
    };
  }

  private async viewOfLocationPhoto(
    locationPhoto: TraceLocationPhotoReadModel | null,
  ): Promise<TraceLocationPhotoView | null> {
    if (locationPhoto === null) {
      return null;
    }
    const [url, thumbUrl] = await Promise.all([
      this.storage.getUrl(locationPhoto.path),
      this.signedUrlOrNull(locationPhoto.thumbPath),
    ]);
    return {
      id: locationPhoto.id,
      url,
      thumbUrl,
      sha256: locationPhoto.sha256,
      sealedAt: locationPhoto.sealedAt,
    };
  }

  private signedUrlOrNull(storedPath: string | null): Promise<string | null> {
    return storedPath === null
      ? Promise.resolve(null)
      : this.storage.getUrl(storedPath);
  }
}
