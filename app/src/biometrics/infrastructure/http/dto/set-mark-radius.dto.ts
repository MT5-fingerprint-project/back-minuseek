import { ApiProperty } from '@nestjs/swagger';
import { IsInt, Max, Min } from 'class-validator';
import {
  MAX_MARK_RADIUS,
  MIN_MARK_RADIUS,
} from '../../../domain/mark-radius.vo';

export class SetMarkRadiusDto {
  @ApiProperty({
    description:
      "Rayon des repères de minuties de la pièce, en pixels de l'image source",
    minimum: MIN_MARK_RADIUS,
    maximum: MAX_MARK_RADIUS,
    example: 36,
  })
  @IsInt()
  @Min(MIN_MARK_RADIUS)
  @Max(MAX_MARK_RADIUS)
  markRadius!: number;
}
