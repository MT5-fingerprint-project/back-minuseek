import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsISO8601,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsPositive,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';
import { MAX_DEVICE_MODEL_LENGTH } from '../../../domain/trace/value-objects/capture-metadata.vo';

// Les dimensions ne veulent rien dire l'une sans l'autre : chacune n'est
// validée que si l'une des deux est présente, ce qui fait échouer celle qui
// manque au lieu de laisser passer une paire incomplète jusqu'au domaine.
const hasAnyDimension = (dto: UploadTraceDto) =>
  dto.width !== undefined || dto.height !== undefined;

export class UploadTraceDto {
  @ApiProperty({
    description: "UUID du dossier d'investigation auquel rattacher la trace",
    format: 'uuid',
  })
  @IsUUID()
  @IsNotEmpty()
  caseId: string;

  @ApiPropertyOptional({
    description: 'Largeur en pixels de la photo capturée',
    minimum: 1,
  })
  @ValidateIf(hasAnyDimension)
  @Type(() => Number)
  @IsInt()
  @Min(1)
  width?: number;

  @ApiPropertyOptional({
    description: 'Hauteur en pixels de la photo capturée',
    minimum: 1,
  })
  @ValidateIf(hasAnyDimension)
  @Type(() => Number)
  @IsInt()
  @Min(1)
  height?: number;

  @ApiPropertyOptional({
    description:
      'Horodatage EXIF de la prise de vue (à ne pas confondre avec la date de réception serveur)',
    format: 'date-time',
  })
  @ValidateIf((dto: UploadTraceDto) => dto.capturedAt !== undefined)
  @IsISO8601()
  capturedAt?: string;

  @ApiPropertyOptional({
    description: 'Orientation EXIF standard de la photo',
    minimum: 1,
    maximum: 8,
  })
  @ValidateIf((dto: UploadTraceDto) => dto.orientation !== undefined)
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(8)
  orientation?: number;

  @ApiPropertyOptional({
    description: 'Longueur focale en millimètres',
    exclusiveMinimum: true,
    minimum: 0,
  })
  @ValidateIf((dto: UploadTraceDto) => dto.focalLength !== undefined)
  @Type(() => Number)
  @IsNumber()
  @IsPositive()
  focalLength?: number;

  @ApiPropertyOptional({
    description: "Modèle de l'appareil de capture",
    maxLength: MAX_DEVICE_MODEL_LENGTH,
    example: 'iPhone 14 Pro',
  })
  @ValidateIf((dto: UploadTraceDto) => dto.deviceModel !== undefined)
  @IsString()
  @IsNotEmpty()
  @MaxLength(MAX_DEVICE_MODEL_LENGTH)
  deviceModel?: string;
}
