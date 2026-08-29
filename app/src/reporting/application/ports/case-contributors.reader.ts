export interface CaseContributorData {
  userId: string | null;
  grade: string | null;
  displayName: string;
}

export interface CaseContributorsReader {
  read(caseId: string): Promise<CaseContributorData[]>;
}

export const CASE_CONTRIBUTORS_READER = 'CaseContributorsReader';
