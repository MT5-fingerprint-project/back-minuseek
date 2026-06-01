import { InvestigationCaseStatusEnum } from '../../../domain/investigation-case/value-objects/investigation-case-status.vo';

export class ListInvestigationCasesQuery {
  constructor(
    public readonly status?: InvestigationCaseStatusEnum,
    public readonly page?: number,
    public readonly limit?: number,
  ) {}
}
