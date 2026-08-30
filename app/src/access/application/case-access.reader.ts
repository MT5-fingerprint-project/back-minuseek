export const CASE_ACCESS_READER = 'CaseAccessReader';

export type CaseTitle = 'CASE_OPERATOR' | 'CASE_VERIFIER';

export type CaseResourceKind =
  | 'TRACE'
  | 'REFERENCE_PRINT'
  | 'IMAGE'
  | 'LAYER'
  | 'SUBJECT'
  | 'REPORT';

export interface CaseScopeTarget {
  kind: 'CASE' | CaseResourceKind;
  id: string;
}

export interface CaseAccessGrant {
  title: CaseTitle;
  verificationInProgress: boolean;
}

export interface CaseAccessReader {
  findGrant(userId: string, caseId: string): Promise<CaseAccessGrant | null>;
  findCaseIdsOf(userId: string): Promise<string[]>;
  findCaseIdOfResource(
    kind: CaseResourceKind,
    resourceId: string,
  ): Promise<string | null>;
}
