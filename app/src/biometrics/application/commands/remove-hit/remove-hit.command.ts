import { AuditActor } from '../../../../shared/domain/audit/audit-actor.vo';

export class RemoveHitCommand {
  constructor(
    public readonly actor: AuditActor,
    public readonly caseId: string,
    public readonly traceId: string,
    public readonly referencePrintId: string,
  ) {}
}
