import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

export class SaisineAssistantDto {
  @ApiPropertyOptional({ description: "Nom de l'assistant" })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  name: string;

  @ApiPropertyOptional({
    description: 'Tâche pour laquelle il a été sollicité',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  task: string;
}

export class UpdateCaseSaisineDto {
  @ApiPropertyOptional({ description: 'Nom du magistrat mandant' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  magistrateName?: string;

  @ApiPropertyOptional({ description: 'Qualité du magistrat mandant' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  magistrateTitle?: string;

  @ApiPropertyOptional({ description: "Date de l'ordonnance (ISO 8601)" })
  @IsOptional()
  @IsDateString()
  ordinanceDate?: string;

  @ApiPropertyOptional({ description: 'Objet de la mission confiée' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  missionObject?: string;

  @ApiPropertyOptional({ description: 'Nombre de scellés' })
  @IsOptional()
  @IsInt()
  @Min(1)
  sealCount?: number;

  @ApiPropertyOptional({
    description: 'Nouvelle date limite de dépôt (ISO 8601)',
  })
  @IsOptional()
  @IsDateString()
  prorogationDeadline?: string;

  @ApiPropertyOptional({
    description: "Date de l'ordonnance de prorogation (ISO 8601)",
  })
  @IsOptional()
  @IsDateString()
  prorogationOrdinanceDate?: string;

  @ApiPropertyOptional({
    description: "Précautions prises en vue d'analyses biologiques",
  })
  @IsOptional()
  @IsBoolean()
  biologicalPrecautions?: boolean;

  @ApiPropertyOptional({ type: [SaisineAssistantDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SaisineAssistantDto)
  assistants?: SaisineAssistantDto[];
}
