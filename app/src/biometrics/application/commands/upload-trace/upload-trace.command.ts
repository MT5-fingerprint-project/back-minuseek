export class UploadTraceCommand {
  constructor(
    public readonly fileBuffer: Buffer,
    public readonly caseId: string,
  ) {}
}
