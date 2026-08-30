import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsString, MaxLength, ValidateIf } from 'class-validator';
import {
  MAX_WITHDRAWAL_MOTIVE_DETAIL_LENGTH,
  WithdrawalMotiveEnum,
} from '../../../domain/withdrawal/withdrawal.vo';

export class WithdrawPieceDto {
  @ApiProperty({
    description:
      'Motif du retrait, inscrit au journal et imprimé dans le rapport',
    enum: WithdrawalMotiveEnum,
  })
  @IsEnum(WithdrawalMotiveEnum)
  motive!: WithdrawalMotiveEnum;

  @ApiPropertyOptional({
    description:
      "Motif écrit par l'opérateur, obligatoire avec OTHER et refusé avec les autres motifs",
    maxLength: MAX_WITHDRAWAL_MOTIVE_DETAIL_LENGTH,
  })
  @ValidateIf(
    (dto: WithdrawPieceDto) => dto.motive === WithdrawalMotiveEnum.OTHER,
  )
  @IsString()
  @MaxLength(MAX_WITHDRAWAL_MOTIVE_DETAIL_LENGTH)
  motiveDetail?: string;
}
