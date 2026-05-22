export class OpenInvestigationCaseCommand {
  constructor(
    public readonly caseNumber: string,
    public readonly pvNumber: string,
    public readonly description?: string,
  ) {}
}
