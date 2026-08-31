import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsUUID } from 'class-validator';

export class GetServiceActivityDto {
  @ApiPropertyOptional({
    description: "Restreint les chiffres aux affaires d'un opérateur",
  })
  @IsUUID()
  @IsOptional()
  operatorUserId?: string;
}
