import { AuditActor } from '../../../../shared/domain/audit/audit-actor.vo';

export class AttachLocationPhotoCommand {
  constructor(
    public readonly actor: AuditActor,
    public readonly traceId: string,
    public readonly fileBuffer: Buffer,
  ) {}
}
