import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsUUID } from 'class-validator';

export class UploadTraceDto {
  @ApiProperty({
    description: "UUID du dossier d'investigation auquel rattacher la trace",
    format: 'uuid',
  })
  @IsUUID()
  @IsNotEmpty()
  caseId: string;
}
