import { FileDigest } from '../../file-digest.vo';
import { FingerPosition } from '../value-objects/finger-position.vo';

export interface ReferencePrintPrimitives {
  id: string;
  path: string;
  caseId: string;
  sha256: string | null;
  subjectId: string | null;
  position: string | null;
}

interface CreateReferencePrintProps {
  id: string;
  path: string;
  caseId: string;
  sha256: FileDigest;
  subjectId?: string | null;
  position?: FingerPosition | null;
}

export class ReferencePrint {
  private constructor(
    private readonly _id: string,
    private readonly _path: string,
    private readonly _caseId: string,
    private readonly _sha256: FileDigest | null,
    private readonly _subjectId: string | null,
    private readonly _position: FingerPosition | null,
  ) {}

  static create(props: CreateReferencePrintProps): ReferencePrint {
    if (!props.id) {
      throw new Error('ReferencePrint id is required');
    }
    if (!props.path) {
      throw new Error('ReferencePrint path is required');
    }
    if (!props.caseId) {
      throw new Error('ReferencePrint caseId is required');
    }
    return new ReferencePrint(
      props.id,
      props.path,
      props.caseId,
      props.sha256,
      props.subjectId ?? null,
      props.position ?? null,
    );
  }

  static reconstitute(primitives: ReferencePrintPrimitives): ReferencePrint {
    return new ReferencePrint(
      primitives.id,
      primitives.path,
      primitives.caseId,
      primitives.sha256 === null ? null : FileDigest.from(primitives.sha256),
      primitives.subjectId,
      primitives.position ? FingerPosition.from(primitives.position) : null,
    );
  }

  toPrimitives(): ReferencePrintPrimitives {
    return {
      id: this._id,
      path: this._path,
      caseId: this._caseId,
      sha256: this._sha256?.getValue() ?? null,
      subjectId: this._subjectId,
      position: this._position ? this._position.getValue() : null,
    };
  }

  get id(): string {
    return this._id;
  }

  get path(): string {
    return this._path;
  }

  get caseId(): string {
    return this._caseId;
  }

  get sha256(): string | null {
    return this._sha256?.getValue() ?? null;
  }

  get subjectId(): string | null {
    return this._subjectId;
  }

  get position(): FingerPosition | null {
    return this._position;
  }
}
