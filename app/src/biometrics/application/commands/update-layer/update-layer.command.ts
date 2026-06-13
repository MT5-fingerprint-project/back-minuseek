import type { LayerSettings } from '../../../domain/layer/entity/layer';

export class UpdateLayerCommand {
  constructor(
    public readonly id: string,
    public readonly name?: string,
    public readonly zIndex?: number,
    public readonly isVisible?: boolean,
    public readonly settings?: LayerSettings,
  ) {}
}
