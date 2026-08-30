import { VerificationDetailReadModel } from '../get-verification/verification-detail-read-model';
import { CaseVerificationReadModel } from './case-verification-read-model';

export interface CaseVerificationReader {
  findByCaseId(caseId: string): Promise<CaseVerificationReadModel[]>;
  findForVerifier(verifierUserId: string): Promise<CaseVerificationReadModel[]>;
  findDetailById(
    verificationId: string,
  ): Promise<VerificationDetailReadModel | null>;
}

export const CASE_VERIFICATION_READER = 'CaseVerificationReader';
