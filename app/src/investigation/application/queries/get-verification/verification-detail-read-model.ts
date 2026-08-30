import { CaseVerificationReadModel } from '../list-case-verifications/case-verification-read-model';

export interface VerificationConclusionReadModel {
  traceId: string;
  exploitability: string;
  identifiedReferencePrintId: string | null;
  outcome: string | null;
  statedAt: Date;
}

export interface VerificationDetailReadModel extends CaseVerificationReadModel {
  conclusions: VerificationConclusionReadModel[];
}
