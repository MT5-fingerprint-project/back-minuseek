import { AuditActor } from '../../../../shared/domain/audit/audit-actor.vo';

export class CompareTraceCommand {
  constructor(
    public readonly actor: AuditActor,
    public readonly caseId: string,
    public readonly traceId: string,
    public readonly referencePrintIds: string[],
  ) {}
}
