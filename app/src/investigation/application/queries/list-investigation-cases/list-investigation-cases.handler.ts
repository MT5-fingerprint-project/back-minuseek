import { Inject } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import {
  INVESTIGATION_CASE_REPOSITORY,
  InvestigationCaseRepository,
} from '../../../domain/investigation-case/repository/investigation-case.repository';
import { ListInvestigationCasesQuery } from './list-investigation-cases.query';

@QueryHandler(ListInvestigationCasesQuery)
export class ListInvestigationCasesHandler implements IQueryHandler<ListInvestigationCasesQuery> {
  constructor(
    @Inject(INVESTIGATION_CASE_REPOSITORY)
    private readonly repo: InvestigationCaseRepository,
  ) {}

  async execute(query: ListInvestigationCasesQuery) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const { cases, total } = await this.repo.findAll(
      { status: query.status },
      { skip, take: limit },
    );

    return {
      data: cases.map((c) => ({
        id: c.id,
        caseNumber: c.caseNumber,
        pvNumber: c.pvNumber,
        description: c.description,
        status: c.status,
        createdAt: c.createdAt,
        updatedAt: c.updatedAt,
      })),
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }
}
