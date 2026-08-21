import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsNumber, Min } from 'class-validator';

export class CaptureQualityDto {
  @ApiProperty({
    description:
      "Variance du Laplacien mesurée sur l'aperçu au déclenchement : plus elle est haute, plus l'image est nette",
    minimum: 0,
    example: 128.4,
  })
  @IsNumber()
  @Min(0)
  blurScore: number;

  @ApiProperty({
    description: 'Verdict rendu on-device au seuil de netteté embarqué',
    example: true,
  })
  @IsBoolean()
  passed: boolean;
}
