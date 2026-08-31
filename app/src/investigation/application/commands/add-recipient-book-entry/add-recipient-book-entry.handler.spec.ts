import { InMemoryAuditTrailAppender } from '../../../../audit-trail/infrastructure/persistence/in-memory-audit-trail.appender';
import { IdGenerator } from '../../../../shared/domain/ports/id-generator';
import { InvalidRecipientBookEntryError } from '../../../domain/recipient-book-entry/errors/invalid-recipient-book-entry.error';
import { InMemoryRecipientBookEntryRepository } from '../../../infrastructure/persistence/in-memory-recipient-book-entry.repository';
import { AddRecipientBookEntryCommand } from './add-recipient-book-entry.command';
import { AddRecipientBookEntryHandler } from './add-recipient-book-entry.handler';

const AUTHORITY =
  'Le Commissaire Général, chef du 3e District de Police Judiciaire';

class FixedIdGenerator implements IdGenerator {
  generate(): string {
    return 'entry-1';
  }
}

describe('AddRecipientBookEntryHandler', () => {
  let repo: InMemoryRecipientBookEntryRepository;
  let auditTrail: InMemoryAuditTrailAppender;
  let handler: AddRecipientBookEntryHandler;

  beforeEach(() => {
    auditTrail = new InMemoryAuditTrailAppender();
    repo = new InMemoryRecipientBookEntryRepository();
    handler = new AddRecipientBookEntryHandler(repo, new FixedIdGenerator());
  });

  it('persiste la fiche et rend son identifiant', async () => {
    const id = await handler.execute(
      new AddRecipientBookEntryCommand(
        AUTHORITY,
        'Brigadier-Chef de Police',
        'MARCHAND Claire',
      ),
    );

    expect(id).toBe('entry-1');
    const stored = repo.store.get('entry-1');
    expect(stored?.authority).toBe(AUTHORITY);
    expect(stored?.attentionQuality).toBe('Brigadier-Chef de Police');
    expect(stored?.attentionName).toBe('MARCHAND Claire');
  });

  it('persiste une fiche sans mention « à l’attention de »', async () => {
    await handler.execute(new AddRecipientBookEntryCommand(AUTHORITY));

    expect(repo.store.get('entry-1')?.attentionName).toBeNull();
  });

  // Le carnet est un catalogue de service, rattaché à aucune affaire : il n'a
  // rien à faire dans la chaîne d'actes.
  it("n'inscrit aucun acte au journal", async () => {
    await handler.execute(new AddRecipientBookEntryCommand(AUTHORITY));

    expect(auditTrail.events).toHaveLength(0);
  });

  it('refuse une autorité vide sans rien persister', async () => {
    await expect(
      handler.execute(new AddRecipientBookEntryCommand('   ')),
    ).rejects.toThrow(InvalidRecipientBookEntryError);

    expect(repo.store.size).toBe(0);
    expect(auditTrail.events).toHaveLength(0);
  });
});
