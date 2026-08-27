import { ApiProperty } from '@nestjs/swagger';
import { IsString, Matches, MaxLength } from 'class-validator';

// @IsNotEmpty() laisserait passer une chaîne d'espaces, que le domaine refuse :
// la frontière et l'invariant diraient alors deux choses différentes.
const NON_BLANK = /\S/;
// Même borne que create-organization-user.dto.ts sur les mêmes colonnes : sans
// elle, un matricule démesuré dépasse la limite d'index btree et ressort en 500.
const MAX_LENGTH = 255;

export class CorrectUserProfileDto {
  @ApiProperty({ description: 'Prénom' })
  @IsString()
  @Matches(NON_BLANK)
  @MaxLength(MAX_LENGTH)
  firstName: string;

  @ApiProperty({ description: 'Nom' })
  @IsString()
  @Matches(NON_BLANK)
  @MaxLength(MAX_LENGTH)
  lastName: string;

  @ApiProperty({ description: 'Grade' })
  @IsString()
  @Matches(NON_BLANK)
  @MaxLength(MAX_LENGTH)
  grade: string;

  @ApiProperty({ description: 'Matricule' })
  @IsString()
  @Matches(NON_BLANK)
  @MaxLength(MAX_LENGTH)
  serviceNumber: string;
}
