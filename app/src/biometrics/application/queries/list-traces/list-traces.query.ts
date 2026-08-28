export class ListTracesQuery {
  constructor(
    public readonly caseId: string,
    public readonly withdrawn: boolean = false,
  ) {}
}
