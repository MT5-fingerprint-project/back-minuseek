import { AuditActor } from '../../../../shared/domain/audit/audit-actor.vo';
import { VerificationExploitabilityEnum } from '../../../domain/case-verification/value-objects/verification-exploitability.vo';

export class RecordVerificationConclusionCommand {
  constructor(
    public readonly actor: AuditActor,
    public readonly requesterId: string,
    public readonly verificationId: string,
    public readonly traceId: string,
    public readonly exploitability: VerificationExploitabilityEnum,
    public readonly identifiedReferencePrintId: string | null,
  ) {}
}
