import { ApiProperty } from '@nestjs/swagger';
import { ArrayNotEmpty, ArrayUnique, IsUUID } from 'class-validator';

export class CompareTraceDto {
  @ApiProperty({
    description:
      "UUID de l'affaire à laquelle la trace et les empreintes doivent appartenir",
    format: 'uuid',
  })
  @IsUUID()
  caseId!: string;

  @ApiProperty({
    description: 'UUIDs des empreintes de référence à comparer avec la trace',
    type: [String],
  })
  @IsUUID('4', { each: true })
  @ArrayNotEmpty()
  @ArrayUnique()
  referencePrintIds!: string[];
}
