import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsUUID } from 'class-validator';

export class ListReferencePrintsDto {
  @ApiProperty({
    description:
      "UUID du dossier d'investigation dont lister les empreintes de référence",
    format: 'uuid',
  })
  @IsUUID()
  @IsNotEmpty()
  caseId!: string;
}
