import type {
  LayerSettings,
  LayerType,
} from '../../../domain/layer/entity/layer';

export interface LayerReadModel {
  id: string;
  fingerprintId: string;
  name: string;
  type: LayerType;
  zIndex: number;
  isVisible: boolean;
  settings: LayerSettings;
}
