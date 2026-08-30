import { CaseVerificationReadModel } from './case-verification-read-model';

export interface CaseVerificationReader {
  findByCaseId(caseId: string): Promise<CaseVerificationReadModel[]>;
  findForVerifier(verifierUserId: string): Promise<CaseVerificationReadModel[]>;
}

export const CASE_VERIFICATION_READER = 'CaseVerificationReader';
