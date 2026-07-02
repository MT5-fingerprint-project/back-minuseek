export interface MatchingPrimitives {
  id: string;
  traceId: string;
  referencePrintId: string;
  score: number;
  match: boolean;
}

interface CreateMatchingProps {
  id: string;
  traceId: string;
  referencePrintId: string;
  score: number;
  match: boolean;
}

export class Matching {
  private constructor(
    private readonly _id: string,
    private readonly _traceId: string,
    private readonly _referencePrintId: string,
    private readonly _score: number,
    private readonly _match: boolean,
  ) {}

  static create(props: CreateMatchingProps): Matching {
    return new Matching(
      props.id,
      props.traceId,
      props.referencePrintId,
      props.score,
      props.match,
    );
  }

  toPrimitives(): MatchingPrimitives {
    return {
      id: this._id,
      traceId: this._traceId,
      referencePrintId: this._referencePrintId,
      score: this._score,
      match: this._match,
    };
  }

  get id(): string { return this._id; }
  get traceId(): string { return this._traceId; }
  get referencePrintId(): string { return this._referencePrintId; }
  get score(): number { return this._score; }
  get match(): boolean { return this._match; }
}
