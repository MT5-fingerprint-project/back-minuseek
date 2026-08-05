import { FingerPosition } from '../value-objects/finger-position.vo';

export interface ReferencePrintPrimitives {
  id: string;
  path: string;
  caseId: string;
  subjectId: string | null;
  position: string | null;
}

interface CreateReferencePrintProps {
  id: string;
  path: string;
  caseId: string;
  subjectId?: string | null;
  position?: FingerPosition | null;
}

export class ReferencePrint {
  private constructor(
    private readonly _id: string,
    private readonly _path: string,
    private readonly _caseId: string,
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
      props.subjectId ?? null,
      props.position ?? null,
    );
  }

  static reconstitute(primitives: ReferencePrintPrimitives): ReferencePrint {
    return new ReferencePrint(
      primitives.id,
      primitives.path,
      primitives.caseId,
      primitives.subjectId,
      primitives.position ? FingerPosition.from(primitives.position) : null,
    );
  }

  toPrimitives(): ReferencePrintPrimitives {
    return {
      id: this._id,
      path: this._path,
      caseId: this._caseId,
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

  get subjectId(): string | null {
    return this._subjectId;
  }

  get position(): FingerPosition | null {
    return this._position;
  }
}
