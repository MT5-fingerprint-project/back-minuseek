import { IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class OpenInvestigationCaseDto {
  @ApiProperty({ description: 'Numéro de dossier unique', example: '2026-001' })
  @IsString()
  @IsNotEmpty()
  caseNumber: string;

  @ApiProperty({ description: 'Numéro de procès-verbal associé', example: 'PV-2026-042' })
  @IsString()
  @IsNotEmpty()
  pvNumber: string;

  @ApiProperty({ description: 'Description facultative du dossier', example: 'Affaire de vol à main armée', required: false })
  @IsString()
  @IsOptional()
  description?: string;
}
