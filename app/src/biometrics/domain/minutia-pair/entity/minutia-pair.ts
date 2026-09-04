export interface MinutiaPairPrimitives {
  id: string;
  traceId: string;
  referencePrintId: string;
  traceMinutiaLayerId: string;
  referenceMinutiaLayerId: string;
  createdByUserId: string | null;
  createdAt: Date;
}

export class MinutiaPair {
  private constructor(
    private readonly _id: string,
    private readonly _traceId: string,
    private readonly _referencePrintId: string,
    private readonly _traceMinutiaLayerId: string,
    private readonly _referenceMinutiaLayerId: string,
    private readonly _createdByUserId: string | null,
    private readonly _createdAt: Date,
  ) {}

  static fromPrimitives(props: MinutiaPairPrimitives): MinutiaPair {
    return new MinutiaPair(
      props.id,
      props.traceId,
      props.referencePrintId,
      props.traceMinutiaLayerId,
      props.referenceMinutiaLayerId,
      props.createdByUserId,
      new Date(props.createdAt),
    );
  }

  toPrimitives(): MinutiaPairPrimitives {
    return {
      id: this._id,
      traceId: this._traceId,
      referencePrintId: this._referencePrintId,
      traceMinutiaLayerId: this._traceMinutiaLayerId,
      referenceMinutiaLayerId: this._referenceMinutiaLayerId,
      createdByUserId: this._createdByUserId,
      createdAt: new Date(this._createdAt),
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
  get traceMinutiaLayerId(): string {
    return this._traceMinutiaLayerId;
  }
  get referenceMinutiaLayerId(): string {
    return this._referenceMinutiaLayerId;
  }
  get createdByUserId(): string | null {
    return this._createdByUserId;
  }
  get createdAt(): Date {
    return new Date(this._createdAt);
  }
}
