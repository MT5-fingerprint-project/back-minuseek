import { AuditActor } from '../../../../shared/domain/audit/audit-actor.vo';
import { UserRoleEnum } from '../../../../identity-access/domain/user/value-objects/user-role.vo';
import { ServiceLetterhead } from '../../../domain/service-settings/entity/service-settings';

export interface ServiceSettingsRequester {
  id: string;
  role: UserRoleEnum;
}

export class SaveServiceSettingsCommand {
  constructor(
    public readonly actor: AuditActor,
    public readonly requester: ServiceSettingsRequester,
    public readonly letterhead: ServiceLetterhead,
  ) {}
}
