import { CaseStatusPort } from '../../application/ports/case-status.port';

export class InMemoryCaseStatusAdapter implements CaseStatusPort {
  private readonly statuses = new Map<string, string>();

  set(caseId: string, status: string): void {
    this.statuses.set(caseId, status);
  }

  findStatus(caseId: string): Promise<string | null> {
    return Promise.resolve(this.statuses.get(caseId) ?? null);
  }
}
