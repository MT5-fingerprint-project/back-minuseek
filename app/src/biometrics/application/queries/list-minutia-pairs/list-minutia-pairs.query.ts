export class ListMinutiaPairsQuery {
  constructor(
    public readonly traceId: string,
    public readonly referencePrintId: string,
    public readonly blindVerifierUserId: string | null = null,
  ) {}
}
