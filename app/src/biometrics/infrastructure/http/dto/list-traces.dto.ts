import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsUUID } from 'class-validator';

export class ListTracesDto {
  @ApiProperty({
    description: "UUID du dossier d'investigation dont lister les traces",
    format: 'uuid',
  })
  @IsUUID()
  @IsNotEmpty()
  caseId!: string;
}
