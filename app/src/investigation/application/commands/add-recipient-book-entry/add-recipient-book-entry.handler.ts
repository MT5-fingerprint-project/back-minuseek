import { Inject } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import {
  ID_GENERATOR,
  IdGenerator,
} from '../../../../shared/domain/ports/id-generator';
import { RecipientBookEntry } from '../../../domain/recipient-book-entry/entity/recipient-book-entry';
import {
  RECIPIENT_BOOK_ENTRY_REPOSITORY,
  RecipientBookEntryRepository,
} from '../../../domain/recipient-book-entry/repository/recipient-book-entry.repository';
import { AddRecipientBookEntryCommand } from './add-recipient-book-entry.command';

@CommandHandler(AddRecipientBookEntryCommand)
export class AddRecipientBookEntryHandler implements ICommandHandler<
  AddRecipientBookEntryCommand,
  string
> {
  constructor(
    @Inject(RECIPIENT_BOOK_ENTRY_REPOSITORY)
    private readonly repo: RecipientBookEntryRepository,
    @Inject(ID_GENERATOR)
    private readonly idGenerator: IdGenerator,
  ) {}

  async execute(cmd: AddRecipientBookEntryCommand): Promise<string> {
    const id = this.idGenerator.generate();
    await this.repo.save(
      RecipientBookEntry.create({
        id,
        authority: cmd.authority,
        attentionQuality: cmd.attentionQuality,
        attentionName: cmd.attentionName,
      }),
    );
    return id;
  }
}
