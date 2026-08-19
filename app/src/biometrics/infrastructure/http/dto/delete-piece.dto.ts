import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class DeletePieceDto {
  @ApiPropertyOptional({
    description:
      'Motif de la suppression, inscrit tel quel dans la chaîne d’audit',
    maxLength: 500,
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
