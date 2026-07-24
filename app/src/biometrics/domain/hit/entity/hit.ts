export interface HitPrimitives {
  id: string;
  traceId: string;
  referencePrintId: string;
  declaredByUserId: string | null;
}

interface CreateHitProps {
  id: string;
  traceId: string;
  referencePrintId: string;
  declaredByUserId?: string | null;
}

export class Hit {
  private constructor(
    private readonly _id: string,
    private readonly _traceId: string,
    private readonly _referencePrintId: string,
    private readonly _declaredByUserId: string | null,
  ) {}

  static create(props: CreateHitProps): Hit {
    return new Hit(
      props.id,
      props.traceId,
      props.referencePrintId,
      props.declaredByUserId ?? null,
    );
  }

  static fromPrimitives(props: HitPrimitives): Hit {
    return new Hit(
      props.id,
      props.traceId,
      props.referencePrintId,
      props.declaredByUserId,
    );
  }

  toPrimitives(): HitPrimitives {
    return {
      id: this._id,
      traceId: this._traceId,
      referencePrintId: this._referencePrintId,
      declaredByUserId: this._declaredByUserId,
    };
  }

  get id(): string {
    return this._id;
  }
  get traceId(): string {
    return this._traceId;
  }
  get referencePrintId(): string {
    return this._referencePrintId;
  }
}
