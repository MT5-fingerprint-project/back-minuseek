import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  Equals,
  IsArray,
  IsInt,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';

export const CURVE_FILTER_KEY = 'curve';
export const CURVE_MAX_LEVEL = 255;
/** Une courbe est une poignée de points : au-delà, le journal ne l'énonce plus. */
export const CURVE_MAX_POINTS = 16;

export class CurvePointDto {
  @IsInt()
  @Min(0)
  @Max(CURVE_MAX_LEVEL)
  x: number;

  @IsInt()
  @Min(0)
  @Max(CURVE_MAX_LEVEL)
  y: number;
}

export class CurveSettingsDto {
  @Equals(CURVE_FILTER_KEY)
  filterKey: string;

  @IsArray()
  @ArrayMinSize(2)
  @ArrayMaxSize(CURVE_MAX_POINTS)
  @ValidateNested({ each: true })
  @Type(() => CurvePointDto)
  points: CurvePointDto[];
}
