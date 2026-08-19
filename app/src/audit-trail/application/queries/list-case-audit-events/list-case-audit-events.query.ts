import { AuditEventTypeEnum } from '../../../../shared/domain/audit/audit-event-type.vo';

export class ListCaseAuditEventsQuery {
  constructor(
    public readonly caseId: string,
    public readonly eventType?: AuditEventTypeEnum,
    public readonly page?: number,
    public readonly limit?: number,
  ) {}
}
