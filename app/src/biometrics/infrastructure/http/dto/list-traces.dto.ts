import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsNotEmpty, IsOptional, IsUUID } from 'class-validator';

export class ListTracesDto {
  @ApiProperty({
    description: "UUID du dossier d'investigation dont lister les traces",
    format: 'uuid',
  })
  @IsUUID()
  @IsNotEmpty()
  caseId!: string;

  @ApiPropertyOptional({
    description:
      'À « true », liste les pièces retirées du dossier au lieu des pièces vivantes',
    enum: ['true', 'false'],
  })
  @IsOptional()
  @IsIn(['true', 'false'])
  withdrawn?: string;
}
