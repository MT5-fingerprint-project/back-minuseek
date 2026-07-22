export class LinkSubjectToCaseCommand {
  constructor(
    public readonly subjectId: string,
    public readonly caseId: string,
    public readonly type: string,
  ) {}
}
