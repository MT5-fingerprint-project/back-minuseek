import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, Max, Min } from 'class-validator';
import {
  MAX_RESOLUTION_DPI,
  MIN_RESOLUTION_DPI,
} from '../../../domain/image-resolution.vo';

export class CalibrateImageDto {
  @ApiProperty({
    description:
      "Résolution calibrée par l'opérateur sur la règle photographiée, en points par pouce de l'image déposée",
    minimum: MIN_RESOLUTION_DPI,
    maximum: MAX_RESOLUTION_DPI,
    example: 1207.34,
  })
  @IsNumber()
  @Min(MIN_RESOLUTION_DPI)
  @Max(MAX_RESOLUTION_DPI)
  resolutionDpi!: number;
}
