export interface ReferencePrintPrimitives {
  id: string;
  path: string;
  caseId: string;
}

interface CreateReferencePrintProps {
  id: string;
  path: string;
  caseId: string;
}

export class ReferencePrint {
  private constructor(
    private readonly _id: string,
    private readonly _path: string,
    private readonly _caseId: string,
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
    return new ReferencePrint(props.id, props.path, props.caseId);
  }

  static reconstitute(primitives: ReferencePrintPrimitives): ReferencePrint {
    return new ReferencePrint(
      primitives.id,
      primitives.path,
      primitives.caseId,
    );
  }

  toPrimitives(): ReferencePrintPrimitives {
    return {
      id: this._id,
      path: this._path,
      caseId: this._caseId,
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
}
