export class RecordHitCommand {
  constructor(
    public readonly caseId: string,
    public readonly traceId: string,
    public readonly referencePrintId: string,
    public readonly declaredByUserId: string | null = null,
  ) {}
}
