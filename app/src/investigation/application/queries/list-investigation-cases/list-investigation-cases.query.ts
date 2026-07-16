import { InvestigationCaseStatusEnum } from '../../../domain/investigation-case/value-objects/investigation-case-status.vo';

export class ListInvestigationCasesQuery {
  constructor(
    public readonly status?: InvestigationCaseStatusEnum,
    public readonly page?: number,
    public readonly limit?: number,
    /** Scope INV-12 : restreint la liste aux affaires assignées à cet
     * opérateur. `undefined` = pas de restriction (ADMIN, tout le tenant). */
    public readonly operatorId?: string,
  ) {}
}
