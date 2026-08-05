import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsUUID } from 'class-validator';

export class ListSubjectsDto {
  @ApiProperty({
    description: "UUID de l'affaire dont on liste les sujets",
    format: 'uuid',
  })
  @IsUUID()
  @IsNotEmpty()
  caseId: string;
}
