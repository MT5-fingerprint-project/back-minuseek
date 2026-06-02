import { InvestigationCaseStatusEnum } from '../../../domain/investigation-case/value-objects/investigation-case-status.vo';
import { InvestigationCaseReadModel } from './investigation-case-read-model';

export interface InvestigationCaseReader {
  findAll(
    filters: { status?: InvestigationCaseStatusEnum },
    pagination: { skip: number; take: number },
  ): Promise<{ items: InvestigationCaseReadModel[]; total: number }>;
}

export const INVESTIGATION_CASE_READER = 'InvestigationCaseReader';
