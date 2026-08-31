import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

/** Les trois lignes forment un bloc : ce que le corps ne porte pas est effacé du
 * dossier. */
export class UpdateCaseRecipientDto {
  @ApiPropertyOptional({
    description: 'Autorité à laquelle le rapport est adressé',
    example:
      'Le Commissaire Général, chef du 3e District de Police Judiciaire de la D.R.P.J de Paris',
  })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  authority?: string;

  @ApiPropertyOptional({
    description:
      'Qualité de la personne à l’attention de qui le rapport est mis',
    example: 'Brigadier-Chef de Police',
  })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  attentionQuality?: string;

  @ApiPropertyOptional({
    description: 'Nom de la personne à l’attention de qui le rapport est mis',
    example: 'MARCHAND Claire',
  })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  attentionName?: string;
}
