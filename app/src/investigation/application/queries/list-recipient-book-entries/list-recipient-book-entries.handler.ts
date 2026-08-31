import { Inject } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { ListRecipientBookEntriesQuery } from './list-recipient-book-entries.query';
import {
  RECIPIENT_BOOK_ENTRIES_READER,
  RecipientBookEntriesReader,
} from './recipient-book-entries.reader';
import { RecipientBookEntryReadModel } from './recipient-book-entry-read-model';

@QueryHandler(ListRecipientBookEntriesQuery)
export class ListRecipientBookEntriesHandler implements IQueryHandler<ListRecipientBookEntriesQuery> {
  constructor(
    @Inject(RECIPIENT_BOOK_ENTRIES_READER)
    private readonly reader: RecipientBookEntriesReader,
  ) {}

  async execute(): Promise<{ data: RecipientBookEntryReadModel[] }> {
    const data = await this.reader.findAll();
    return { data };
  }
}
