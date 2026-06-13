import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { DeleteLayerCommand } from './delete-layer.command';
import { LayerNotFoundError } from '../../../domain/layer/errors/layer-not-found.error';
import {
  LAYER_REPOSITORY,
  type LayerRepository,
} from '../../../domain/layer/repository/layer.repository';

@CommandHandler(DeleteLayerCommand)
export class DeleteLayerHandler implements ICommandHandler<DeleteLayerCommand> {
  constructor(
    @Inject(LAYER_REPOSITORY) private readonly repository: LayerRepository,
  ) {}

  async execute(command: DeleteLayerCommand): Promise<void> {
    const layer = await this.repository.findById(command.id);
    if (!layer) throw new LayerNotFoundError(command.id);
    await this.repository.delete(command.id);
  }
}
