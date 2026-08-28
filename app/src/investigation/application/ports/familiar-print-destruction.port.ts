import type { AuditActor } from '../../../shared/domain/audit/audit-actor.vo';

export interface FamiliarPrintDestructionPort {
  destroyForCase(
    caseId: string,
    actor: AuditActor,
  ): Promise<{ destroyedCount: number }>;
}

export const FAMILIAR_PRINT_DESTRUCTION = 'FamiliarPrintDestruction';
