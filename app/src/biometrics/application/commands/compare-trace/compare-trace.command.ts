export class CompareTraceCommand {
  constructor(
    public readonly caseId: string,
    public readonly traceId: string,
    public readonly referencePrintIds: string[],
  ) {}
}
