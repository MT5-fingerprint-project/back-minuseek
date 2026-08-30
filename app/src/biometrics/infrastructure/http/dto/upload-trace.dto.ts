import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type, plainToInstance } from 'class-transformer';
import {
  IsISO8601,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsObject,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { CaptureQualityDto } from './capture-quality.dto';
import { MAX_DEVICE_MODEL_LENGTH } from '../../../domain/trace/value-objects/capture-metadata.vo';
import { MAX_TRACE_LOCATION_LENGTH } from '../../../domain/trace/entity/trace';

// Les dimensions ne veulent rien dire l'une sans l'autre : chacune n'est
// validée que si l'une des deux est présente, ce qui fait échouer celle qui
// manque au lieu de laisser passer une paire incomplète jusqu'au domaine.
const hasAnyDimension = (dto: UploadTraceDto) =>
  dto.width !== undefined || dto.height !== undefined;

const CAPTURE_QUALITY_SHAPE =
  'captureQuality doit être un objet JSON { blurScore: number, passed: boolean }';

// Le multipart ne transporte que des chaînes : le contrôle qualité arrive en
// JSON sérialisé. On le parse ici, et on en fait une instance de
// `CaptureQualityDto` pour que `@ValidateNested` retrouve ses métadonnées — sur
// un objet nu il n'en trouverait aucune et laisserait tout passer. Tout le
// reste (JSON invalide, scalaire, `null`, tableau) ressort inchangé de
// `plainToInstance` et se fait rejeter par `@IsObject`.
const parseCaptureQuality = ({ value }: { value: unknown }): unknown => {
  if (typeof value !== 'string') return value;
  try {
    return plainToInstance(CaptureQualityDto, JSON.parse(value));
  } catch {
    return value;
  }
};

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

  @ApiPropertyOptional({
    description:
      'Localisation de la trace, écrite sur les lieux au moment de la capture',
    maxLength: MAX_TRACE_LOCATION_LENGTH,
    example: "Sur l'extérieur de la porte d'entrée de l'appartement",
  })
  @IsOptional()
  @IsString()
  @MaxLength(MAX_TRACE_LOCATION_LENGTH)
  location?: string;

  @ApiPropertyOptional({
    type: CaptureQualityDto,
    description:
      'Contrôle de netteté relevé au déclenchement, transmis en chaîne JSON dans le multipart',
  })
  @ValidateIf((dto: UploadTraceDto) => dto.captureQuality !== undefined)
  @Transform(parseCaptureQuality)
  @IsObject({ message: CAPTURE_QUALITY_SHAPE })
  @ValidateNested()
  captureQuality?: CaptureQualityDto;
}
