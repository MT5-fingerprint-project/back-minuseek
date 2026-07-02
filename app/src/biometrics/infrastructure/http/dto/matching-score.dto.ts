import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsNumber, IsUUID } from 'class-validator';

export class MatchingScoreDto {
  @ApiProperty({
    description: 'UUID de l’empreinte de référence comparée',
    format: 'uuid',
  })
  @IsUUID()
  referencePrintId!: string;

  @ApiProperty({ description: 'Score de correspondance' })
  @IsNumber()
  score!: number;

  @ApiProperty({ description: 'La trace correspond-elle à cette empreinte' })
  @IsBoolean()
  match!: boolean;
}
