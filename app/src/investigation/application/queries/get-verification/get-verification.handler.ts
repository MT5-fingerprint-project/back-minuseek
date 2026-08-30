import { Inject } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { VerificationNotFoundError } from '../../../domain/case-verification/errors/verification-not-found.error';
import {
  CASE_VERIFICATION_READER,
  CaseVerificationReader,
} from '../list-case-verifications/case-verification.reader';
import { GetVerificationQuery } from './get-verification.query';
import { VerificationDetailReadModel } from './verification-detail-read-model';

@QueryHandler(GetVerificationQuery)
export class GetVerificationHandler implements IQueryHandler<GetVerificationQuery> {
  constructor(
    @Inject(CASE_VERIFICATION_READER)
    private readonly reader: CaseVerificationReader,
  ) {}

  async execute(
    query: GetVerificationQuery,
  ): Promise<VerificationDetailReadModel> {
    const verification = await this.reader.findDetailById(query.verificationId);
    if (!verification) {
      throw new VerificationNotFoundError(query.verificationId);
    }
    if (verification.verifierUserId !== query.requesterId) {
      throw new VerificationNotFoundError(query.verificationId);
    }
    return verification;
  }
}
