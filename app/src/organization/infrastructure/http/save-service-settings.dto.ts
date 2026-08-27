import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength } from 'class-validator';

const MAX_LENGTH = 255;

// Un en-tête s'enregistre en entier : un champ laissé vide est une valeur, pas
// une absence, et le rapport doit pouvoir cesser d'imprimer une ligne.
export class SaveServiceSettingsDto {
  @ApiProperty({
    description: 'Administration ou direction dont dépend le service',
    example:
      "MINISTÈRE DE L'INTÉRIEUR — DIRECTION GÉNÉRALE DE LA POLICE NATIONALE",
  })
  @IsString()
  @MaxLength(MAX_LENGTH)
  administration: string;

  @ApiProperty({
    description: 'Nom du service',
    example: 'SERVICE RÉGIONAL DE POLICE TECHNIQUE ET SCIENTIFIQUE',
  })
  @IsString()
  @MaxLength(MAX_LENGTH)
  serviceName: string;

  @ApiProperty({
    description: 'Adresse postale du service',
    example: '36 rue du Bastion — 75017 PARIS',
  })
  @IsString()
  @MaxLength(MAX_LENGTH)
  postalAddress: string;

  @ApiProperty({
    description: 'Téléphone du service',
    example: '01 40 79 60 00',
  })
  @IsString()
  @MaxLength(MAX_LENGTH)
  phoneNumber: string;

  @ApiProperty({
    description: 'Courriel du service',
    example: 'srpts.paris@interieur.gouv.fr',
  })
  @IsString()
  @MaxLength(MAX_LENGTH)
  email: string;

  @ApiProperty({
    description: 'Ville du « Fait à … » de la signature',
    example: 'Paris',
  })
  @IsString()
  @MaxLength(MAX_LENGTH)
  signatureCity: string;
}
