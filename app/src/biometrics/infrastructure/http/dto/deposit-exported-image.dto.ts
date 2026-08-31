import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsUUID } from 'class-validator';

export class DepositExportedImageDto {
  @ApiProperty({
    description: "UUID de la trace ou de l'empreinte de référence exportée",
    format: 'uuid',
  })
  @IsUUID()
  @IsNotEmpty()
  sourcePieceId: string;
}
