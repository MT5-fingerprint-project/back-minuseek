import {
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  ValidateIf,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { SexEnum } from '../../../domain/subject/value-objects/sex.vo';
import { SubjectTypeEnum } from '../../../domain/subject-case/value-objects/subject-type.vo';

const whenCreating = (o: RegisterSubjectDto) => !o.subjectId;

export class RegisterSubjectDto {
  @ApiPropertyOptional({
    description:
      "UUID d'un sujet existant à associer à l'affaire. S'il est fourni, les champs d'identité sont ignorés ; sinon ils sont requis et un nouveau sujet est créé.",
    format: 'uuid',
  })
  @IsOptional()
  @IsUUID()
  subjectId?: string;

  @ApiProperty({
    description: "UUID de l'affaire sur laquelle rattacher le sujet",
    format: 'uuid',
  })
  @IsUUID()
  @IsNotEmpty()
  caseId: string;

  @ApiProperty({
    description: 'Type du sujet sur cette affaire',
    enum: SubjectTypeEnum,
  })
  @IsEnum(SubjectTypeEnum)
  type: SubjectTypeEnum;

  @ApiPropertyOptional({
    description: 'Prénom (requis si subjectId absent)',
    example: 'Jean',
  })
  @ValidateIf(whenCreating)
  @IsString()
  @IsNotEmpty()
  firstName?: string;

  @ApiPropertyOptional({
    description: 'Nom (requis si subjectId absent)',
    example: 'Dupont',
  })
  @ValidateIf(whenCreating)
  @IsString()
  @IsNotEmpty()
  lastName?: string;

  @ApiPropertyOptional({
    description: 'Date de naissance ISO 8601 (requise si subjectId absent)',
    example: '1990-05-14',
  })
  @ValidateIf(whenCreating)
  @IsDateString()
  birthDate?: string;

  @ApiPropertyOptional({
    description: 'Lieu de naissance (requis si subjectId absent)',
    example: 'Lyon',
  })
  @ValidateIf(whenCreating)
  @IsString()
  @IsNotEmpty()
  birthPlace?: string;

  @ApiPropertyOptional({
    description: 'Sexe (requis si subjectId absent)',
    enum: SexEnum,
  })
  @ValidateIf(whenCreating)
  @IsEnum(SexEnum)
  sex?: SexEnum;

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
