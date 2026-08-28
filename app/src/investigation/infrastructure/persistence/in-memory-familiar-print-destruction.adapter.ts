import type { AuditActor } from '../../../shared/domain/audit/audit-actor.vo';
import type { FamiliarPrintDestructionPort } from '../../application/ports/familiar-print-destruction.port';

export class InMemoryFamiliarPrintDestruction implements FamiliarPrintDestructionPort {
  readonly calls: { caseId: string; actor: AuditActor }[] = [];
  private destroyable = new Map<string, number>();
  private failure: Error | null = null;

  set(caseId: string, count: number): void {
    this.destroyable.set(caseId, count);
  }

  failWith(failure: Error): void {
    this.failure = failure;
  }

  destroyForCase(
    caseId: string,
    actor: AuditActor,
  ): Promise<{ destroyedCount: number }> {
    if (this.failure) {
      return Promise.reject(this.failure);
    }
    this.calls.push({ caseId, actor });
    const destroyedCount = this.destroyable.get(caseId) ?? 0;
    this.destroyable.set(caseId, 0);
    return Promise.resolve({ destroyedCount });
  }
}
