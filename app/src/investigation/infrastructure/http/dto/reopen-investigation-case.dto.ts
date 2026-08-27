import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class ReopenInvestigationCaseDto {
  @ApiProperty({
    description: 'Motif de la réouverture, inscrit au journal des actes',
    maxLength: 500,
    example: 'Réquisition complémentaire du 12 septembre 2026',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  reason!: string;
}
