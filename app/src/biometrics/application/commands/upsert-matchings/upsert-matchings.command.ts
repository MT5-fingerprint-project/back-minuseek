export interface MatchingScoreInput {
  referencePrintId: string;
  score: number;
  match: boolean;
}

export class UpsertMatchingsCommand {
  constructor(
    public readonly traceId: string,
    public readonly matchings: MatchingScoreInput[],
  ) {}
}
