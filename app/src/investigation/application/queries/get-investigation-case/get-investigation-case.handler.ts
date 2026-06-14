import { Inject } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { InvestigationCaseReadModel } from '../list-investigation-cases/investigation-case-read-model';
import {
  INVESTIGATION_CASE_READER,
  InvestigationCaseReader,
} from '../list-investigation-cases/investigation-case.reader';
import { GetInvestigationCaseQuery } from './get-investigation-case.query';
import { CaseNotFoundError } from '../../../domain/investigation-case/errors/case-not-found.error';

@QueryHandler(GetInvestigationCaseQuery)
export class GetInvestigationCaseHandler implements IQueryHandler<GetInvestigationCaseQuery> {
  constructor(
    @Inject(INVESTIGATION_CASE_READER)
    private readonly reader: InvestigationCaseReader,
  ) {}

  async execute(
    query: GetInvestigationCaseQuery,
  ): Promise<InvestigationCaseReadModel> {
    const investigationCase = await this.reader.findById(query.id);
    if (!investigationCase) throw new CaseNotFoundError(query.id);

    return investigationCase;
  }
}
