import { AuditActor } from '../../../../shared/domain/audit/audit-actor.vo';
import { StatedRecipient } from '../../../domain/investigation-case/entity/investigation-case';

export class UpdateCaseRecipientCommand {
  constructor(
    public readonly actor: AuditActor,
    public readonly caseId: string,
    public readonly recipient: StatedRecipient,
  ) {}
}
