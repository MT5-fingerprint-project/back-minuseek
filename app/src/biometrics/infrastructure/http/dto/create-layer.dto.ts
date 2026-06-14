import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsUUID,
} from 'class-validator';
import type {
  LayerType,
  LayerSettings,
} from '../../../domain/layer/entity/layer';
import { IsLayerSettings } from '../validators/is-layer-settings.validator';

export class CreateLayerDto {
  @ApiPropertyOptional({
    format: 'uuid',
    description: 'UUID du calque (autogénéré si absent)',
  })
  @IsUUID()
  @IsOptional()
  id?: string;

  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  @IsNotEmpty()
  fingerprintId: string;

  @ApiProperty({ example: 'Minuties Identifiées' })
  @IsNotEmpty()
  name: string;

  @ApiProperty({ enum: ['ANNOTATION', 'FILTER'] })
  @IsEnum(['ANNOTATION', 'FILTER'])
  type: LayerType;

  @ApiProperty({ example: 1 })
  @IsInt()
  zIndex: number;

  @ApiProperty({
    description: 'Configuration flexible du calque (filtres ou annotations)',
  })
  @IsObject()
  @IsLayerSettings()
  settings: LayerSettings;
}
