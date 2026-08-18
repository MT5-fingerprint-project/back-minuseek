import { UNAUDITED_TABLES } from '../../../shared/domain/audit/unaudited-tables';

const AUDIT_MODEL = 'AuditEvent';

const MUTATING_MODEL_OPERATIONS = new Set([
  'create',
  'createMany',
  'createManyAndReturn',
  'update',
  'updateMany',
  'updateManyAndReturn',
  'upsert',
  'delete',
  'deleteMany',
]);

const MUTATING_RAW_OPERATIONS = new Set(['$executeRaw', '$executeRawUnsafe']);

export class TransactionMutationJournal {
  private readonly mutatedTables = new Set<string>();
  private chained = false;

  record(model: string | undefined, operation: string): void {
    if (model === AUDIT_MODEL) {
      this.chained ||= MUTATING_MODEL_OPERATIONS.has(operation);
      return;
    }
    if (model === undefined) {
      if (MUTATING_RAW_OPERATIONS.has(operation)) {
        this.mutatedTables.add(operation);
      }
      return;
    }
    if (MUTATING_MODEL_OPERATIONS.has(operation)) {
      this.mutatedTables.add(model);
    }
  }

  unchainedTables(): string[] {
    if (this.chained) {
      return [];
    }
    return [...this.mutatedTables]
      .filter((table) => !(table in UNAUDITED_TABLES))
      .sort();
  }
}
