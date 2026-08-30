import { FileDigest } from '../../file-digest.vo';

export interface TraceLocationPhotoPrimitives {
  id: string;
  traceId: string;
  caseId: string;
  path: string;
  sha256: string;
}

interface AttachTraceLocationPhotoProps {
  id: string;
  traceId: string;
  caseId: string;
  path: string;
  sha256: FileDigest;
}

export class TraceLocationPhoto {
  private constructor(
    private readonly _id: string,
    private readonly _traceId: string,
    private readonly _caseId: string,
    private readonly _path: string,
    private readonly _sha256: FileDigest,
  ) {}

  static attach(props: AttachTraceLocationPhotoProps): TraceLocationPhoto {
    if (!props.id) {
      throw new Error('TraceLocationPhoto id is required');
    }
    if (!props.traceId) {
      throw new Error('TraceLocationPhoto traceId is required');
    }
    if (!props.caseId) {
      throw new Error('TraceLocationPhoto caseId is required');
    }
    if (!props.path) {
      throw new Error('TraceLocationPhoto path is required');
    }
    return new TraceLocationPhoto(
      props.id,
      props.traceId,
      props.caseId,
      props.path,
      props.sha256,
    );
  }

  static reconstitute(
    primitives: TraceLocationPhotoPrimitives,
  ): TraceLocationPhoto {
    return new TraceLocationPhoto(
      primitives.id,
      primitives.traceId,
      primitives.caseId,
      primitives.path,
      FileDigest.from(primitives.sha256),
    );
  }

  toPrimitives(): TraceLocationPhotoPrimitives {
    return {
      id: this._id,
      traceId: this._traceId,
      caseId: this._caseId,
      path: this._path,
      sha256: this._sha256.getValue(),
    };
  }

  get id(): string {
    return this._id;
  }

  get traceId(): string {
    return this._traceId;
  }

  get caseId(): string {
    return this._caseId;
  }

  get path(): string {
    return this._path;
  }

  get sha256(): string {
    return this._sha256.getValue();
  }
}
