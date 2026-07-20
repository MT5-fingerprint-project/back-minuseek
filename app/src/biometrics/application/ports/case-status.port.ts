export interface CaseStatusPort {
  findStatus(caseId: string): Promise<string | null>;
}

export const CASE_STATUS = 'CaseStatus';
