import { AuditActor } from '../../../../shared/domain/audit/audit-actor.vo';

export class DeclareCaseExpertiseCommand {
  constructor(
    public readonly actor: AuditActor,
    public readonly requesterUserId: string,
    public readonly caseId: string,
    public readonly oathStatement: string,
    public readonly courtReference: string,
  ) {}
}
