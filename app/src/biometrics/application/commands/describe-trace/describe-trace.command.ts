import { AuditActor } from '../../../../shared/domain/audit/audit-actor.vo';

export class DescribeTraceCommand {
  constructor(
    public readonly actor: AuditActor,
    public readonly id: string,
    public readonly origin: string,
    public readonly location: string,
    public readonly revelationTechnique: string,
  ) {}
}
