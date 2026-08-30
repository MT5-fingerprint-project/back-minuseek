export class ListTracesQuery {
  constructor(
    public readonly caseId: string,
    public readonly withdrawn: boolean = false,
    public readonly blindVerifierUserId: string | null = null,
  ) {}
}
