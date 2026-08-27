import { AuditActor } from '../../../../shared/domain/audit/audit-actor.vo';
import { UserRoleEnum } from '../../../../identity-access/domain/user/value-objects/user-role.vo';
import { CaseCorrection } from '../../../domain/investigation-case/entity/investigation-case';

export interface CaseUpdateRequester {
  id: string;
  role: UserRoleEnum;
}

export interface CaseUpdate extends CaseCorrection {
  operatorUserId?: string;
}

export class UpdateInvestigationCaseCommand {
  constructor(
    public readonly actor: AuditActor,
    public readonly requester: CaseUpdateRequester,
    public readonly caseId: string,
    public readonly changes: CaseUpdate,
  ) {}
}
