export class UploadReferencePrintCommand {
  constructor(
    public readonly fileBuffer: Buffer,
    public readonly originalName: string,
    public readonly mimeType: string,
    public readonly caseId: string,
  ) {}
}
