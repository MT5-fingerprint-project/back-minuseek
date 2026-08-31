import { Inject } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { RecipientBookEntryNotFoundError } from '../../../domain/recipient-book-entry/errors/recipient-book-entry-not-found.error';
import {
  RECIPIENT_BOOK_ENTRY_REPOSITORY,
  RecipientBookEntryRepository,
} from '../../../domain/recipient-book-entry/repository/recipient-book-entry.repository';
import { RemoveRecipientBookEntryCommand } from './remove-recipient-book-entry.command';

@CommandHandler(RemoveRecipientBookEntryCommand)
export class RemoveRecipientBookEntryHandler implements ICommandHandler<
  RemoveRecipientBookEntryCommand,
  void
> {
  constructor(
    @Inject(RECIPIENT_BOOK_ENTRY_REPOSITORY)
    private readonly repo: RecipientBookEntryRepository,
  ) {}

  async execute(cmd: RemoveRecipientBookEntryCommand): Promise<void> {
    const entry = await this.repo.findById(cmd.id);
    if (!entry) throw new RecipientBookEntryNotFoundError(cmd.id);

    await this.repo.delete(cmd.id);
  }
}
