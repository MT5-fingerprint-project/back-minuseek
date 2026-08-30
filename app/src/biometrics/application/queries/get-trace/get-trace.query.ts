export class GetTraceQuery {
  constructor(
    public readonly traceId: string,
    public readonly blindVerifierUserId: string | null = null,
  ) {}
}
