import { InvestigationCase } from '../entity/investigation-case';

export interface InvestigationCaseRepository {
  save(c: InvestigationCase): Promise<void>;
  existsByCaseNumber(caseNumber: string): Promise<boolean>;
}

export const INVESTIGATION_CASE_REPOSITORY = 'InvestigationCaseRepository';
