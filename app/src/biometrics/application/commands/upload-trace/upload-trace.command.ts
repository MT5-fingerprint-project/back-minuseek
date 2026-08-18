import { AuditActor } from '../../../../shared/domain/audit/audit-actor.vo';

export class UploadTraceCommand {
  constructor(
    public readonly actor: AuditActor,
    public readonly fileBuffer: Buffer,
    public readonly originalName: string,
    public readonly mimeType: string,
    public readonly caseId: string,
  ) {}
}
