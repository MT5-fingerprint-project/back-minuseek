import { Inject } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { CaseVerificationReadModel } from './case-verification-read-model';
import {
  CASE_VERIFICATION_READER,
  CaseVerificationReader,
} from './case-verification.reader';
import { ListCaseVerificationsQuery } from './list-case-verifications.query';

@QueryHandler(ListCaseVerificationsQuery)
export class ListCaseVerificationsHandler implements IQueryHandler<ListCaseVerificationsQuery> {
  constructor(
    @Inject(CASE_VERIFICATION_READER)
    private readonly reader: CaseVerificationReader,
  ) {}

  execute(
    query: ListCaseVerificationsQuery,
  ): Promise<CaseVerificationReadModel[]> {
    return this.reader.findByCaseId(query.caseId);
  }
}
