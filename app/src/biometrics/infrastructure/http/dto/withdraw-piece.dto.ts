import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';
import { WithdrawalMotiveEnum } from '../../../domain/withdrawal/withdrawal.vo';

export class WithdrawPieceDto {
  @ApiProperty({
    description:
      'Motif du retrait, inscrit au journal et imprimé dans le rapport',
    enum: WithdrawalMotiveEnum,
  })
  @IsEnum(WithdrawalMotiveEnum)
  motive!: WithdrawalMotiveEnum;
}
