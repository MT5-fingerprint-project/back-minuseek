export interface UploadTraceCommand {
  fileBuffer: Buffer;
  originalName: string;
  mimeType: string;
  caseId?: string;
}
