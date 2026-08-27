import { AuditActor } from '../../../../shared/domain/audit/audit-actor.vo';

export class ReopenInvestigationCaseCommand {
  constructor(
    public readonly actor: AuditActor,
    public readonly caseId: string,
    public readonly reason: string,
  ) {}
}
