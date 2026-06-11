import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsUUID } from 'class-validator';

export class UploadReferencePrintDto {
  @ApiProperty({
    description:
      "UUID du dossier d'investigation auquel rattacher l'empreinte de référence",
    format: 'uuid',
  })
  @IsUUID()
  @IsNotEmpty()
  caseId: string;
}
