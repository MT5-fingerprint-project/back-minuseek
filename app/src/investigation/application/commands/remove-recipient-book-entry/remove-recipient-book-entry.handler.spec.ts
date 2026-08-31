import { InMemoryAuditTrailAppender } from '../../../../audit-trail/infrastructure/persistence/in-memory-audit-trail.appender';
import { RecipientBookEntry } from '../../../domain/recipient-book-entry/entity/recipient-book-entry';
import { RecipientBookEntryNotFoundError } from '../../../domain/recipient-book-entry/errors/recipient-book-entry-not-found.error';
import { InMemoryRecipientBookEntryRepository } from '../../../infrastructure/persistence/in-memory-recipient-book-entry.repository';
import { RemoveRecipientBookEntryCommand } from './remove-recipient-book-entry.command';
import { RemoveRecipientBookEntryHandler } from './remove-recipient-book-entry.handler';

const AUTHORITY =
  'Le Commissaire Général, chef du 3e District de Police Judiciaire';

describe('RemoveRecipientBookEntryHandler', () => {
  let repo: InMemoryRecipientBookEntryRepository;
  let auditTrail: InMemoryAuditTrailAppender;
  let handler: RemoveRecipientBookEntryHandler;

  beforeEach(() => {
    auditTrail = new InMemoryAuditTrailAppender();
    repo = new InMemoryRecipientBookEntryRepository();
    repo.seed(
      RecipientBookEntry.create({ id: 'entry-1', authority: AUTHORITY }),
    );
    handler = new RemoveRecipientBookEntryHandler(repo);
  });

  it('retire la fiche du carnet', async () => {
    await handler.execute(new RemoveRecipientBookEntryCommand('entry-1'));

    expect(repo.store.has('entry-1')).toBe(false);
  });

  it("n'inscrit aucun acte au journal", async () => {
    await handler.execute(new RemoveRecipientBookEntryCommand('entry-1'));

    expect(auditTrail.events).toHaveLength(0);
  });

  it('refuse une fiche inconnue sans rien retirer', async () => {
    await expect(
      handler.execute(new RemoveRecipientBookEntryCommand('entry-fantome')),
    ).rejects.toThrow(RecipientBookEntryNotFoundError);

    expect(repo.store.size).toBe(1);
    expect(auditTrail.events).toHaveLength(0);
  });

  it('refuse un second retrait de la même fiche', async () => {
    await handler.execute(new RemoveRecipientBookEntryCommand('entry-1'));

    await expect(
      handler.execute(new RemoveRecipientBookEntryCommand('entry-1')),
    ).rejects.toThrow(RecipientBookEntryNotFoundError);
  });
});
