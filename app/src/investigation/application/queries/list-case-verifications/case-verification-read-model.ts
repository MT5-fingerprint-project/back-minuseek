import { VerificationStatusEnum } from '../../../domain/case-verification/value-objects/verification-status.vo';

export interface VerifierIdentityReadModel {
  firstName: string;
  lastName: string;
}

export interface CaseVerificationReadModel {
  id: string;
  caseId: string;
  caseNumber: string;
  verifierUserId: string;
  verifier: VerifierIdentityReadModel | null;
  status: VerificationStatusEnum;
  requestedAt: Date;
  completedAt: Date | null;
}
