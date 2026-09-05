import { AuditActor } from '../../../../shared/domain/audit/audit-actor.vo';
import { InvestigationCaseStatusEnum } from '../../../domain/investigation-case/value-objects/investigation-case-status.vo';

export class ChangeCaseStatusCommand {
  constructor(
    public readonly actor: AuditActor,
    public readonly caseId: string,
    public readonly targetStatus: InvestigationCaseStatusEnum,
  ) {}
}
