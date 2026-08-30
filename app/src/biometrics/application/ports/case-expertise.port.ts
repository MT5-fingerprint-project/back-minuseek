export interface CaseExpertisePort {
  isUnderExpertise(caseId: string): Promise<boolean>;
}

export const CASE_EXPERTISE = 'CaseExpertise';
