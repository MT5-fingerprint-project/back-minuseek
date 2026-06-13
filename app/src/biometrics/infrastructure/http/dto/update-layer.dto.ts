import { ApiPropertyOptional } from '@nestjs/swagger';
import type { LayerSettings } from '../../../domain/layer/entity/layer';
import {
  IsBoolean,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
} from 'class-validator';

export class UpdateLayerDto {
  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  name?: string;

  @ApiPropertyOptional()
  @IsInt()
  @IsOptional()
  zIndex?: number;

  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  isVisible?: boolean;

  @ApiPropertyOptional()
  @IsObject()
  @IsOptional()
  settings?: LayerSettings;
}
