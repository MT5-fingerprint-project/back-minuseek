import { VerificationConclusionReadModel } from '../../application/queries/get-verification/verification-detail-read-model';
import { VerificationDetailReadModel } from '../../application/queries/get-verification/verification-detail-read-model';
import { CaseVerificationReadModel } from '../../application/queries/list-case-verifications/case-verification-read-model';
import { CaseVerificationReader } from '../../application/queries/list-case-verifications/case-verification.reader';

const mostRecentFirst = (
  left: CaseVerificationReadModel,
  right: CaseVerificationReadModel,
): number =>
  right.requestedAt.getTime() - left.requestedAt.getTime() ||
  left.id.localeCompare(right.id);

export class InMemoryCaseVerificationReader implements CaseVerificationReader {
  constructor(
    readonly items: CaseVerificationReadModel[] = [],
    private readonly conclusions: Record<
      string,
      VerificationConclusionReadModel[]
    > = {},
  ) {}

  findDetailById(
    verificationId: string,
  ): Promise<VerificationDetailReadModel | null> {
    const found = this.items.find(
      (verification) => verification.id === verificationId,
    );
    return Promise.resolve(
      found
        ? { ...found, conclusions: this.conclusions[verificationId] ?? [] }
        : null,
    );
  }

  findByCaseId(caseId: string): Promise<CaseVerificationReadModel[]> {
    return Promise.resolve(
      this.items
        .filter((verification) => verification.caseId === caseId)
        .sort(mostRecentFirst),
    );
  }

  findForVerifier(
    verifierUserId: string,
  ): Promise<CaseVerificationReadModel[]> {
    return Promise.resolve(
      this.items
        .filter(
          (verification) => verification.verifierUserId === verifierUserId,
        )
        .sort(mostRecentFirst),
    );
  }
}
