import { RecipientBookEntry } from '../entity/recipient-book-entry';

/** Le carnet est un catalogue de service, rattaché à aucune affaire : son dépôt
 * est ordinaire, sans acte ni transaction, comme celui des sujets avant que la
 * personne ne devienne une pièce de dossier. */
export interface RecipientBookEntryRepository {
  save(entry: RecipientBookEntry): Promise<void>;
  findById(id: string): Promise<RecipientBookEntry | null>;
  delete(id: string): Promise<void>;
}

export const RECIPIENT_BOOK_ENTRY_REPOSITORY = 'RecipientBookEntryRepository';
