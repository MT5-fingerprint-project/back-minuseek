import { AuditActor } from '../../../../shared/domain/audit/audit-actor.vo';
import { ReportTypeName } from '../../../domain/report/entity/report';

export class GenerateReportCommand {
  constructor(
    public readonly actor: AuditActor,
    public readonly caseId: string,
    public readonly type: ReportTypeName,
  ) {}
}
