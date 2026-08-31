import { applyDecorators } from '@nestjs/common';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  ValidateIf,
} from 'class-validator';

/** Les dix champs judiciaires sont facultatifs et acceptent `null`, qui vide la
 * colonne — `@IsOptional()` laisse passer `null`, ce que ces colonnes prennent. */
const JudicialText = () =>
  applyDecorators(IsOptional(), IsString(), IsNotEmpty());

const JudicialDate = () => applyDecorators(IsOptional(), IsDateString());

export class UpdateInvestigationCaseDto {
  @ApiProperty({
    description: 'Numéro de procès-verbal corrigé',
    example: 'PV-2026-042',
    required: false,
  })
  // @IsOptional() laisserait passer `null`, que la colonne refuse : seul un
  // champ absent est toléré ici.
  @ValidateIf((dto: UpdateInvestigationCaseDto) => dto.pvNumber !== undefined)
  @IsString()
  @IsNotEmpty()
  pvNumber?: string;

  @ApiProperty({
    description: 'Description du dossier ; `null` la vide',
    example: 'Affaire de vol à main armée',
    required: false,
    nullable: true,
  })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  description?: string | null;

  @ApiProperty({
    description: "Compte du service à qui l'affaire est confiée",
    required: false,
  })
  @ValidateIf(
    (dto: UpdateInvestigationCaseDto) => dto.operatorUserId !== undefined,
  )
  @IsUUID()
  operatorUserId?: string;

  @ApiPropertyOptional({
    description: "Date de la demande d'intervention",
    example: '2026-06-04',
    nullable: true,
  })
  @JudicialDate()
  requestDate?: string | null;

  @ApiPropertyOptional({
    description: 'Qualité du requérant',
    example: 'Brigadier-Chef de Police',
    nullable: true,
  })
  @JudicialText()
  requesterQuality?: string | null;

  @ApiPropertyOptional({
    description: 'Nom du requérant',
    example: 'MARCHAND Claire',
    nullable: true,
  })
  @JudicialText()
  requesterName?: string | null;

  @ApiPropertyOptional({
    description: "Service d'affectation du requérant",
    example: '3e District de Police Judiciaire de la D.R.P.J de Paris',
    nullable: true,
  })
  @JudicialText()
  requesterService?: string | null;

  @ApiPropertyOptional({
    description: 'Qualification pénale des faits, en clair',
    example: 'Vol par effraction',
    nullable: true,
  })
  @JudicialText()
  offenseNature?: string | null;

  @ApiPropertyOptional({
    description: 'Lieu des faits',
    example: '12 rue Léon Frot à Paris 11e',
    nullable: true,
  })
  @JudicialText()
  offenseLocation?: string | null;

  @ApiPropertyOptional({
    description: 'Date des faits',
    example: '2026-06-01',
    nullable: true,
  })
  @JudicialDate()
  offenseDateFrom?: string | null;

  @ApiPropertyOptional({
    description:
      'Fin de la période quand les faits couvrent plusieurs jours ; sans début, elle est refusée',
    example: '2026-06-03',
    nullable: true,
  })
  @JudicialDate()
  offenseDateTo?: string | null;

  @ApiPropertyOptional({
    description: "Jour de l'intervention du technicien",
    example: '2026-06-05',
    nullable: true,
  })
  @JudicialDate()
  interventionDate?: string | null;

  @ApiPropertyOptional({
    description:
      "Nom de la personne poursuivie ; « X » lorsque l'auteur est inconnu",
    example: 'X',
    nullable: true,
  })
  @JudicialText()
  caseAgainst?: string | null;
}
