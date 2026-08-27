import { InvestigationCaseStatusEnum } from '../../../domain/investigation-case/value-objects/investigation-case-status.vo';
import { InvestigationCaseReadModel } from './investigation-case-read-model';

export interface InvestigationCaseFilters {
  status?: InvestigationCaseStatusEnum;
  /** Les affaires que l'appelant a le droit de voir. `null` ne filtre pas —
   * c'est le cas du responsable de service. */
  caseIds: string[] | null;
}

export interface InvestigationCaseReader {
  findAll(
    filters: InvestigationCaseFilters,
    pagination: { skip: number; take: number },
  ): Promise<{ items: InvestigationCaseReadModel[]; total: number }>;

  findById(id: string): Promise<InvestigationCaseReadModel | null>;
}

export const INVESTIGATION_CASE_READER = 'InvestigationCaseReader';
