import { Inject } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { ReferencePrintNotFoundError } from '../../../domain/reference-print/errors/reference-print-not-found.error';
import {
  REFERENCE_PRINT_REPOSITORY,
  ReferencePrintRepository,
} from '../../../domain/reference-print/repository/reference-print.repository';
import {
  IMAGE_STORAGE,
  ImageStoragePort,
} from '../../ports/image-storage.port';
import { DeleteReferencePrintCommand } from './delete-reference-print.command';

@CommandHandler(DeleteReferencePrintCommand)
export class DeleteReferencePrintHandler implements ICommandHandler<
  DeleteReferencePrintCommand,
  void
> {
  constructor(
    @Inject(REFERENCE_PRINT_REPOSITORY)
    private readonly repo: ReferencePrintRepository,
    @Inject(IMAGE_STORAGE)
    private readonly storage: ImageStoragePort,
  ) {}

  async execute(cmd: DeleteReferencePrintCommand): Promise<void> {
    const rp = await this.repo.findById(cmd.id);
    if (!rp) {
      throw new ReferencePrintNotFoundError(cmd.id);
    }
    await this.storage.delete(rp.path);
    await this.repo.delete(cmd.id);
  }
}
