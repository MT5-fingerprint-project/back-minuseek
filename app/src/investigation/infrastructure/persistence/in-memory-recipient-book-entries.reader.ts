import { RecipientBookEntriesReader } from '../../application/queries/list-recipient-book-entries/recipient-book-entries.reader';
import { RecipientBookEntryReadModel } from '../../application/queries/list-recipient-book-entries/recipient-book-entry-read-model';

export class InMemoryRecipientBookEntriesReader implements RecipientBookEntriesReader {
  readonly store: RecipientBookEntryReadModel[] = [];

  findAll(): Promise<RecipientBookEntryReadModel[]> {
    // Même ordre que `prisma-recipient-book-entries.reader.ts`, départage
    // compris : `authority` n'est pas unique, deux fiches homonymes sortiraient
    // dans un ordre libre.
    return Promise.resolve(
      [...this.store].sort(
        (left, right) =>
          left.authority.localeCompare(right.authority) ||
          left.id.localeCompare(right.id),
      ),
    );
  }
}
