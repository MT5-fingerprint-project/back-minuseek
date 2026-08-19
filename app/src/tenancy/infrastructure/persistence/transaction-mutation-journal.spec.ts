import { UNAUDITED_TABLES } from '../../../shared/domain/audit/unaudited-tables';
import { TransactionMutationJournal } from './transaction-mutation-journal';

const [AN_EXEMPTED_TABLE] = Object.keys(UNAUDITED_TABLES);

describe('TransactionMutationJournal', () => {
  it('a bien une table exemptée à observer (garde-fou du garde-fou)', () => {
    expect(AN_EXEMPTED_TABLE).toBeDefined();
  });

  it('ne retient rien tant que la transaction ne fait que lire', () => {
    const journal = new TransactionMutationJournal();

    journal.record('Organization', 'findFirst');
    journal.record('Organization', 'findMany');
    journal.record(undefined, '$queryRaw');

    expect(journal.unchainedTables()).toEqual([]);
  });

  it.each([
    'create',
    'createMany',
    'update',
    'updateMany',
    'upsert',
    'delete',
    'deleteMany',
  ])(
    'retient la mutation « %s » d’une table hors liste blanche',
    (operation) => {
      const journal = new TransactionMutationJournal();

      journal.record('Organization', operation);

      expect(journal.unchainedTables()).toEqual(['Organization']);
    },
  );

  it('retient une écriture SQL brute, qui ne porte aucun modèle', () => {
    const journal = new TransactionMutationJournal();

    journal.record(undefined, '$executeRaw');

    expect(journal.unchainedTables()).toEqual(['$executeRaw']);
  });

  it('oublie tout dès que la chaîne reçoit un maillon', () => {
    const journal = new TransactionMutationJournal();

    journal.record('Organization', 'create');
    journal.record('AuditEvent', 'create');

    expect(journal.unchainedTables()).toEqual([]);
  });

  it('ignore les tables explicitement exemptées', () => {
    const journal = new TransactionMutationJournal();

    journal.record(AN_EXEMPTED_TABLE, 'create');
    journal.record(AN_EXEMPTED_TABLE, 'update');

    expect(journal.unchainedTables()).toEqual([]);
  });

  it('dénonce chaque table fautive une seule fois, en ordre stable', () => {
    const journal = new TransactionMutationJournal();

    journal.record('Organization', 'create');
    journal.record('Organization', 'update');
    journal.record(undefined, '$executeRawUnsafe');

    expect(journal.unchainedTables()).toEqual([
      '$executeRawUnsafe',
      'Organization',
    ]);
  });
});
