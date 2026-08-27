import type { CaseRequester } from '../../../../access/application/case-access.service';
import { InvestigationCaseStatusEnum } from '../../../domain/investigation-case/value-objects/investigation-case-status.vo';

export class ListInvestigationCasesQuery {
  constructor(
    public readonly status?: InvestigationCaseStatusEnum,
    public readonly page?: number,
    public readonly limit?: number,
    /** Le compte du service de l'appelant. `null` quand le jeton n'en a pas :
     * la liste est alors vide, jamais complète. */
    public readonly requester: CaseRequester | null = null,
  ) {}
}
