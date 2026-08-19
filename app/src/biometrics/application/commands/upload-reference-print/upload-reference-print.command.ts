export class UploadReferencePrintCommand {
  constructor(
    public readonly fileBuffer: Buffer,
    public readonly caseId: string,
    public readonly subjectId?: string | null,
    public readonly position?: string | null,
  ) {}
}
