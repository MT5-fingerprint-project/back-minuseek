import { AuditActor } from '../../../../shared/domain/audit/audit-actor.vo';

export class CloseInvestigationCaseCommand {
  constructor(
    public readonly actor: AuditActor,
    public readonly caseId: string,
  ) {}
}
