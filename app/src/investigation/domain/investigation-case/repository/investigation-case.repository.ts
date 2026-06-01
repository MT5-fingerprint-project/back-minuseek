import { InvestigationCase } from '../entity/investigation-case';
import { InvestigationCaseStatusEnum } from '../value-objects/investigation-case-status.vo';

export interface InvestigationCaseRepository {
  save(c: InvestigationCase): Promise<void>;
  existsByCaseNumber(caseNumber: string): Promise<boolean>;
  findAll(
    filters: { status?: InvestigationCaseStatusEnum },
    pagination: { skip: number; take: number },
  ): Promise<{ cases: InvestigationCase[]; total: number }>;
}

export const INVESTIGATION_CASE_REPOSITORY = 'InvestigationCaseRepository';
