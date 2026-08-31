import { RecipientBookEntryReadModel } from './recipient-book-entry-read-model';

export interface RecipientBookEntriesReader {
  findAll(): Promise<RecipientBookEntryReadModel[]>;
}

export const RECIPIENT_BOOK_ENTRIES_READER = 'RecipientBookEntriesReader';
