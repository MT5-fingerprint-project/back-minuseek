import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

export class RequestCaseVerificationDto {
  @ApiProperty({
    description: 'Compte du service à qui la vérification est confiée',
  })
  @IsUUID()
  verifierUserId!: string;
}
