import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsOptional, IsUUID } from 'class-validator';
import { FingerPositionEnum } from '../../../domain/reference-print/value-objects/finger-position.vo';

export class UploadReferencePrintDto {
  @ApiProperty({
    description:
      "UUID du dossier d'investigation auquel rattacher l'empreinte de référence",
    format: 'uuid',
  })
  @IsUUID()
  @IsNotEmpty()
  caseId: string;

  @ApiPropertyOptional({
    description: "UUID du sujet auquel appartient l'empreinte de référence",
    format: 'uuid',
  })
  @IsOptional()
  @IsUUID()
  subjectId?: string;

  @ApiPropertyOptional({
    description: "Position de l'empreinte (doigt ou paume)",
    enum: FingerPositionEnum,
  })
  @IsOptional()
  @IsEnum(FingerPositionEnum)
  position?: FingerPositionEnum;
}
