import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';
import { UserStatusEnum } from '../../../domain/user/value-objects/user-status.vo';

export class ChangeUserStatusDto {
  @ApiProperty({
    enum: UserStatusEnum,
    description: 'État visé du compte chez le fournisseur d’identité',
  })
  @IsEnum(UserStatusEnum)
  status: UserStatusEnum;
}
