import { CaseExpertisePort } from '../../application/ports/case-expertise.port';

export class InMemoryCaseExpertiseAdapter implements CaseExpertisePort {
  private readonly declaredCaseIds = new Set<string>();

  declare(caseId: string): void {
    this.declaredCaseIds.add(caseId);
  }

  isUnderExpertise(caseId: string): Promise<boolean> {
    return Promise.resolve(this.declaredCaseIds.has(caseId));
  }
}
