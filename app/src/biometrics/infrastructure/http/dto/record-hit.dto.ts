import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

export class RecordHitDto {
  @ApiProperty({
    description:
      "UUID de l'affaire à laquelle la trace et l'empreinte doivent appartenir",
    format: 'uuid',
  })
  @IsUUID()
  caseId!: string;

  @ApiProperty({
    description: "UUID de l'empreinte de référence en correspondance avec la trace",
    format: 'uuid',
  })
  @IsUUID()
  referencePrintId!: string;
}
