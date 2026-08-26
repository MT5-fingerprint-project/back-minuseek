import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

export class ChangeCaseOperatorDto {
  @ApiProperty({ description: "Compte du service à qui l'affaire est confiée" })
  @IsUUID()
  operatorUserId: string;
}
