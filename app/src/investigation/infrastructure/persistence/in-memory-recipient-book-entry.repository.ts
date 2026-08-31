import { RecipientBookEntry } from '../../domain/recipient-book-entry/entity/recipient-book-entry';
import { RecipientBookEntryRepository } from '../../domain/recipient-book-entry/repository/recipient-book-entry.repository';

export class InMemoryRecipientBookEntryRepository implements RecipientBookEntryRepository {
  readonly store = new Map<string, RecipientBookEntry>();

  seed(entry: RecipientBookEntry): void {
    this.store.set(entry.id, entry);
  }

  save(entry: RecipientBookEntry): Promise<void> {
    this.store.set(entry.id, entry);
    return Promise.resolve();
  }

  findById(id: string): Promise<RecipientBookEntry | null> {
    return Promise.resolve(this.store.get(id) ?? null);
  }

  delete(id: string): Promise<void> {
    this.store.delete(id);
    return Promise.resolve();
  }
}
