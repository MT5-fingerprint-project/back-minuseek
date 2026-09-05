import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsUUID } from 'class-validator';

export class DepositConcordanceVideoDto {
  @ApiProperty({
    description: 'UUID de la trace montrée à gauche de la démonstration',
    format: 'uuid',
  })
  @IsUUID()
  @IsNotEmpty()
  traceId: string;

  @ApiProperty({
    description: "UUID de l'empreinte de référence montrée à droite",
    format: 'uuid',
  })
  @IsUUID()
  @IsNotEmpty()
  referencePrintId: string;
}
