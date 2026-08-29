import { AuditActor } from '../../../../shared/domain/audit/audit-actor.vo';
import {
  JournalDetailName,
  ReportTypeName,
} from '../../../domain/report/entity/report';
import { ReportSignerData } from '../../report-signer';

export class GenerateReportCommand {
  constructor(
    public readonly actor: AuditActor,
    public readonly caseId: string,
    public readonly type: ReportTypeName,
    public readonly signer: ReportSignerData,
    public readonly journalDetail: JournalDetailName = 'SUMMARY',
  ) {}
}
