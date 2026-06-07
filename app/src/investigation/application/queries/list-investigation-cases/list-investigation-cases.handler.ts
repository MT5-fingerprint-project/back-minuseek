import { Inject } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { PageDto } from '../../../../shared/application/pagination/page.dto';
import { InvestigationCaseReadModel } from './investigation-case-read-model';
import {
  INVESTIGATION_CASE_READER,
  InvestigationCaseReader,
} from './investigation-case.reader';
import { ListInvestigationCasesQuery } from './list-investigation-cases.query';

@QueryHandler(ListInvestigationCasesQuery)
export class ListInvestigationCasesHandler implements IQueryHandler<ListInvestigationCasesQuery> {
  constructor(
    @Inject(INVESTIGATION_CASE_READER)
    private readonly reader: InvestigationCaseReader,
  ) {}

  async execute(
    query: ListInvestigationCasesQuery,
  ): Promise<PageDto<InvestigationCaseReadModel>> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const { items, total } = await this.reader.findAll(
      { status: query.status },
      { skip, take: limit },
    );

    return new PageDto(items, {
      itemCount: total,
      paginationOptions: { page, limit },
    });
  }
}
