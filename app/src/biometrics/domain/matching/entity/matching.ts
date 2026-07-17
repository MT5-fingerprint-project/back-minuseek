import { MatchingScore } from '../value-objects/matching-score.vo';

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
}

export class Matching {
  private constructor(
    private readonly _id: string,
    private readonly _traceId: string,
    private readonly _referencePrintId: string,
    private readonly _score: MatchingScore,
    private readonly _match: boolean,
  ) {}

  static create(props: CreateMatchingProps): Matching {
    const score = MatchingScore.of(props.score);
    return new Matching(
      props.id,
      props.traceId,
      props.referencePrintId,
      score,
      score.isMatch(),
    );
  }

  // Réhydratation depuis la persistence : le verdict stocké fait foi,
  // il n'est pas recalculé si le seuil évolue après coup.
  static fromPrimitives(props: MatchingPrimitives): Matching {
    return new Matching(
      props.id,
      props.traceId,
      props.referencePrintId,
      MatchingScore.of(props.score),
      props.match,
    );
  }

  toPrimitives(): MatchingPrimitives {
    return {
      id: this._id,
      traceId: this._traceId,
      referencePrintId: this._referencePrintId,
      score: this._score.getValue(),
      match: this._match,
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
  get score(): number {
    return this._score.getValue();
  }
  get match(): boolean {
    return this._match;
  }
}
