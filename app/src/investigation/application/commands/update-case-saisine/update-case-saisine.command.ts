import { AuditActor } from '../../../../shared/domain/audit/audit-actor.vo';
import { CaseSaisineChanges } from '../../../domain/case-expertise/entity/case-expertise';

export class UpdateCaseSaisineCommand {
  constructor(
    public readonly actor: AuditActor,
    public readonly requesterUserId: string,
    public readonly caseId: string,
    public readonly saisine: CaseSaisineChanges,
  ) {}
}
