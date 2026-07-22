import { Inject } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { CaseSubjectReadModel } from './case-subject-read-model';
import {
  CASE_SUBJECTS_READER,
  CaseSubjectsReader,
} from './case-subjects.reader';
import { ListSubjectsByCaseQuery } from './list-subjects-by-case.query';

@QueryHandler(ListSubjectsByCaseQuery)
export class ListSubjectsByCaseHandler implements IQueryHandler<ListSubjectsByCaseQuery> {
  constructor(
    @Inject(CASE_SUBJECTS_READER)
    private readonly reader: CaseSubjectsReader,
  ) {}

  async execute(
    query: ListSubjectsByCaseQuery,
  ): Promise<{ data: CaseSubjectReadModel[] }> {
    const data = await this.reader.findByCaseId(query.caseId);
    return { data };
  }
}
