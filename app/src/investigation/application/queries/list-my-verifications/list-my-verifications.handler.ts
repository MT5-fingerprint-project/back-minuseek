import { Inject } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { CaseVerificationReadModel } from '../list-case-verifications/case-verification-read-model';
import {
  CASE_VERIFICATION_READER,
  CaseVerificationReader,
} from '../list-case-verifications/case-verification.reader';
import { ListMyVerificationsQuery } from './list-my-verifications.query';

@QueryHandler(ListMyVerificationsQuery)
export class ListMyVerificationsHandler implements IQueryHandler<ListMyVerificationsQuery> {
  constructor(
    @Inject(CASE_VERIFICATION_READER)
    private readonly reader: CaseVerificationReader,
  ) {}

  execute(
    query: ListMyVerificationsQuery,
  ): Promise<CaseVerificationReadModel[]> {
    if (query.verifierUserId === null) return Promise.resolve([]);
    return this.reader.findForVerifier(query.verifierUserId);
  }
}
