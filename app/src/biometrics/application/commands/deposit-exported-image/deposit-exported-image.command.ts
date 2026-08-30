import { AuditActor } from '../../../../shared/domain/audit/audit-actor.vo';

export class DepositExportedImageCommand {
  constructor(
    public readonly actor: AuditActor,
    public readonly caseId: string,
    public readonly sourcePieceId: string,
    public readonly fileBuffer: Buffer,
  ) {}
}
