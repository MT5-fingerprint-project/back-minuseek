import { AuditActor } from '../../../../shared/domain/audit/audit-actor.vo';

export class UploadReferencePrintCommand {
  constructor(
    public readonly actor: AuditActor,
    public readonly fileBuffer: Buffer,
    public readonly caseId: string,
    public readonly subjectId?: string | null,
    public readonly position?: string | null,
  ) {}
}
