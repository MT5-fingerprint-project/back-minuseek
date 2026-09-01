import { AuditActor } from '../../../../shared/domain/audit/audit-actor.vo';

export class DeclareTraceNotIdentifiedCommand {
  constructor(
    public readonly actor: AuditActor,
    public readonly id: string,
  ) {}
}
