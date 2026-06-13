import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { CreateLayerCommand } from './create-layer.command';
import { Layer } from '../../../domain/layer/entity/layer';
import {
  LAYER_REPOSITORY,
  type LayerRepository,
} from '../../../domain/layer/repository/layer.repository';

@CommandHandler(CreateLayerCommand)
export class CreateLayerHandler implements ICommandHandler<CreateLayerCommand> {
  constructor(
    @Inject(LAYER_REPOSITORY) private readonly repository: LayerRepository,
  ) {}

  async execute(command: CreateLayerCommand): Promise<void> {
    const layer = Layer.create({
      id: command.id,
      fingerprintId: command.fingerprintId,
      name: command.name,
      type: command.type,
      zIndex: command.zIndex,
      settings: command.settings,
    });
    await this.repository.save(layer);
  }
}
