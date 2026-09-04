import { AuditActor } from '../../../../shared/domain/audit/audit-actor.vo';

export class RemoveMinutiaPairCommand {
  constructor(
    public readonly actor: AuditActor,
    public readonly traceId: string,
    public readonly pairId: string,
    public readonly verifierUserId: string | null = null,
  ) {}
}
