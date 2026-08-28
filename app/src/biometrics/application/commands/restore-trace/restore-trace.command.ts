import { AuditActor } from '../../../../shared/domain/audit/audit-actor.vo';

export class RestoreTraceCommand {
  constructor(
    public readonly actor: AuditActor,
    public readonly id: string,
  ) {}
}
