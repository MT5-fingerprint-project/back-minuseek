import { AuditActor } from '../../../../shared/domain/audit/audit-actor.vo';

export class RecordHitCommand {
  constructor(
    public readonly actor: AuditActor,
    public readonly caseId: string,
    public readonly traceId: string,
    public readonly referencePrintId: string,
    public readonly declaredByUserId: string | null = null,
  ) {}
}
