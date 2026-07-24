export class RemoveHitCommand {
  constructor(
    public readonly caseId: string,
    public readonly traceId: string,
    public readonly referencePrintId: string,
  ) {}
}
