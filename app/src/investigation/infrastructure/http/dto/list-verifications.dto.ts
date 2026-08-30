import { ApiProperty } from '@nestjs/swagger';
import { Equals } from 'class-validator';

export class ListVerificationsDto {
  @ApiProperty({
    description: 'Seules ses propres missions en cours sont lisibles',
    enum: ['true'],
  })
  @Equals('true')
  mine!: string;
}
