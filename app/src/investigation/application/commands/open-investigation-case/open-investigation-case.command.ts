import { AuditActor } from '../../../../shared/domain/audit/audit-actor.vo';

export class OpenInvestigationCaseCommand {
  constructor(
    public readonly actor: AuditActor,
    public readonly caseNumber: string,
    public readonly pvNumber: string,
    public readonly description?: string,
  ) {}
}
