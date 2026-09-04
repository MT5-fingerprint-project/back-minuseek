import {
  MINUTIA_SETTINGS_TYPES,
  MinutiaTypeEnum,
} from '../../../shared/domain/forensics/minutiae';
import type { Layer, LayerSettings } from './entity/layer';

export {
  MINUTIA_SETTINGS_TYPES,
  type MinutiaSettingsType,
} from '../../../shared/domain/forensics/minutiae';

export interface MinutiaMark {
  layerId: string;
  x: number | null;
  y: number | null;
  minutiaType: MinutiaTypeEnum;
}

const SETTINGS_TYPES: readonly string[] = MINUTIA_SETTINGS_TYPES;

const MINUTIA_TYPES: readonly string[] = Object.values(MinutiaTypeEnum);

export function isMinutiaLayer(layer: Layer): boolean {
  const { type, settings } = layer.toPrimitives();
  return (
    type === 'ANNOTATION' &&
    typeof settings.type === 'string' &&
    SETTINGS_TYPES.includes(settings.type)
  );
}

export function minutiaMarkOf(layer: Layer): MinutiaMark {
  const { id, settings } = layer.toPrimitives();
  return {
    layerId: id,
    x: coordinate(settings, 'x'),
    y: coordinate(settings, 'y'),
    minutiaType: minutiaTypeOf(settings),
  };
}

export function minutiaTypeOf(settings: LayerSettings): MinutiaTypeEnum {
  const declared = settings.minutiaType;
  return typeof declared === 'string' && MINUTIA_TYPES.includes(declared)
    ? (declared as MinutiaTypeEnum)
    : MinutiaTypeEnum.UNDETERMINED;
}

function coordinate(settings: LayerSettings, axis: 'x' | 'y'): number | null {
  const value = settings[axis];
  return typeof value === 'number' ? value : null;
}
