import { AuditActor } from '../../../../shared/domain/audit/audit-actor.vo';

export class CompleteCaseVerificationCommand {
  constructor(
    public readonly actor: AuditActor,
    public readonly requesterId: string,
    public readonly verificationId: string,
  ) {}
}
