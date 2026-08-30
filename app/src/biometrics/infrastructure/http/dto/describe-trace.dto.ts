import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { MAX_TRACE_LOCATION_LENGTH } from '../../../domain/trace/entity/trace';
import { RevelationTechniqueEnum } from '../../../domain/trace/value-objects/revelation-technique.vo';
import { TraceOriginEnum } from '../../../domain/trace/value-objects/trace-origin.vo';

export class DescribeTraceDto {
  @ApiProperty({
    description: 'Origine de la trace : un doigt ou la paume de la main',
    enum: TraceOriginEnum,
  })
  @IsEnum(TraceOriginEnum)
  origin!: TraceOriginEnum;

  @ApiProperty({
    description:
      'Phrase disant sur quel objet et à quel endroit la trace a été relevée',
    maxLength: MAX_TRACE_LOCATION_LENGTH,
    example: "Sur l'extérieur de la porte d'entrée de l'appartement",
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(MAX_TRACE_LOCATION_LENGTH)
  location!: string;

  @ApiProperty({
    description: 'Technique par laquelle la trace a été rendue visible',
    enum: RevelationTechniqueEnum,
  })
  @IsEnum(RevelationTechniqueEnum)
  revelationTechnique!: RevelationTechniqueEnum;
}
