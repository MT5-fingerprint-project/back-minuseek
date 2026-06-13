import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { UpdateLayerCommand } from './update-layer.command';
import { LayerNotFoundError } from '../../../domain/layer/errors/layer-not-found.error';
import {
  LAYER_REPOSITORY,
  type LayerRepository,
} from '../../../domain/layer/repository/layer.repository';

@CommandHandler(UpdateLayerCommand)
export class UpdateLayerHandler implements ICommandHandler<UpdateLayerCommand> {
  constructor(
    @Inject(LAYER_REPOSITORY) private readonly repository: LayerRepository,
  ) {}

  async execute(command: UpdateLayerCommand): Promise<void> {
    const layer = await this.repository.findById(command.id);
    if (!layer) throw new LayerNotFoundError(command.id);
    layer.update({
      name: command.name,
      zIndex: command.zIndex,
      isVisible: command.isVisible,
      settings: command.settings,
    });
    await this.repository.save(layer);
  }
}
