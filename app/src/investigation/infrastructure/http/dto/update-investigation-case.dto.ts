import { ApiProperty } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  ValidateIf,
} from 'class-validator';

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
}
