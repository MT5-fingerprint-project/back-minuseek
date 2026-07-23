import {
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { SexEnum } from '../../../domain/subject/value-objects/sex.vo';
import { SubjectTypeEnum } from '../../../domain/subject/value-objects/subject-type.vo';

export class RegisterSubjectDto {
  @ApiProperty({ description: 'Prénom', example: 'Jean' })
  @IsString()
  @IsNotEmpty()
  firstName: string;

  @ApiProperty({ description: 'Nom', example: 'Dupont' })
  @IsString()
  @IsNotEmpty()
  lastName: string;

  @ApiProperty({
    description: 'Date de naissance (ISO 8601)',
    example: '1990-05-14',
  })
  @IsDateString()
  birthDate: string;

  @ApiProperty({ description: 'Lieu de naissance', example: 'Lyon' })
  @IsString()
  @IsNotEmpty()
  birthPlace: string;

  @ApiProperty({ description: 'Sexe', enum: SexEnum })
  @IsEnum(SexEnum)
  sex: SexEnum;

  @ApiProperty({ description: 'Type du sujet', enum: SubjectTypeEnum })
  @IsEnum(SubjectTypeEnum)
  type: SubjectTypeEnum;

  @ApiProperty({
    description: "UUID de l'affaire à laquelle appartient le sujet",
    format: 'uuid',
  })
  @IsUUID()
  @IsNotEmpty()
  caseId: string;

  @ApiPropertyOptional({ description: 'Nom/prénom du parent 1' })
  @IsOptional()
  @IsString()
  firstParentName?: string;

  @ApiPropertyOptional({ description: 'Nom/prénom du parent 2' })
  @IsOptional()
  @IsString()
  secondParentName?: string;

  @ApiPropertyOptional({ description: 'Téléphone', example: '+33612345678' })
  @IsOptional()
  @IsString()
  phoneNumber?: string;

  @ApiPropertyOptional({
    description:
      'Couleur associée au sujet (hex), ex. pour border ses empreintes côté front',
    example: '#FF5733',
  })
  @IsOptional()
  @Matches(/^#[0-9A-Fa-f]{6}$/, {
    message: 'color doit être une couleur hexadécimale au format #RRGGBB',
  })
  color?: string;
}
