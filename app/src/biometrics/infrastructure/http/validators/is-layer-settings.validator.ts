import { plainToInstance, type ClassConstructor } from 'class-transformer';
import {
  registerDecorator,
  validateSync,
  type ValidationArguments,
  type ValidationOptions,
} from 'class-validator';
import { CircleSettingsDto } from '../dto/settings/circle-settings.dto';
import { CircleArrowSettingsDto } from '../dto/settings/circle-arrow-settings.dto';
import { PencilSettingsDto } from '../dto/settings/pencil-settings.dto';
import { FilterSettingsDto } from '../dto/settings/filter-settings.dto';

type SettingsDto = ClassConstructor<object>;

const ANNOTATION_DTOS: Record<string, SettingsDto> = {
  circle: CircleSettingsDto,
  circleArrow: CircleArrowSettingsDto,
  pencil: PencilSettingsDto,
};

/**
 * Selects the settings DTO to validate against.
 * - On create the sibling `type` field (ANNOTATION/FILTER) drives the choice.
 * - On update there is no `type`, so we infer from the settings content.
 */
function pickSettingsDto(
  value: Record<string, unknown>,
  layerType: unknown,
): SettingsDto | null {
  if (layerType === 'FILTER') return FilterSettingsDto;
  if (layerType === 'ANNOTATION') {
    return ANNOTATION_DTOS[value.type as string] ?? null;
  }
  // Update path: infer the family from the payload itself.
  if ('filterKey' in value) return FilterSettingsDto;
  if (typeof value.type === 'string' && value.type in ANNOTATION_DTOS) {
    return ANNOTATION_DTOS[value.type];
  }
  return null;
}

export function IsLayerSettings(options?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'isLayerSettings',
      target: object.constructor,
      propertyName,
      options,
      validator: {
        validate(value: unknown, args: ValidationArguments): boolean {
          if (
            value === null ||
            typeof value !== 'object' ||
            Array.isArray(value)
          ) {
            return false;
          }
          const layerType = (args.object as { type?: unknown }).type;
          const Dto = pickSettingsDto(
            value as Record<string, unknown>,
            layerType,
          );
          if (!Dto) return false;

          const instance = plainToInstance(Dto, value);
          const errors = validateSync(instance, {
            whitelist: true,
            forbidNonWhitelisted: true,
          });
          return errors.length === 0;
        },
        defaultMessage(args: ValidationArguments): string {
          const layerType = (args.object as { type?: unknown }).type;
          const suffix =
            typeof layerType === 'string' ? ` for a ${layerType} layer` : '';
          return `settings is not a valid payload${suffix}`;
        },
      },
    });
  };
}
