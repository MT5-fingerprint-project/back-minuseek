import { Inject } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { PageDto } from '../../../../shared/application/pagination/page.dto';
import { CaseAuditEventReadModel } from './case-audit-event-read-model';
import {
  CASE_AUDIT_EVENT_READER,
  CaseAuditEventReader,
} from './case-audit-event.reader';
import { ListCaseAuditEventsQuery } from './list-case-audit-events.query';

@QueryHandler(ListCaseAuditEventsQuery)
export class ListCaseAuditEventsHandler implements IQueryHandler<ListCaseAuditEventsQuery> {
  constructor(
    @Inject(CASE_AUDIT_EVENT_READER)
    private readonly reader: CaseAuditEventReader,
  ) {}

  async execute(
    query: ListCaseAuditEventsQuery,
  ): Promise<PageDto<CaseAuditEventReadModel>> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const { items, total } = await this.reader.findByCase(
      query.caseId,
      { eventType: query.eventType },
      { skip, take: limit },
    );

    return new PageDto(items, {
      itemCount: total,
      paginationOptions: { page, limit },
    });
  }
}
