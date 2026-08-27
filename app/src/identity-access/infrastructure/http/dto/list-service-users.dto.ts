import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { PaginationQueryDto } from '../../../../shared/infrastructure/http/dto/pagination-query.dto';
import { UserRoleEnum } from '../../../domain/user/value-objects/user-role.vo';
import { UserStatusEnum } from '../../../domain/user/value-objects/user-status.vo';

const MAX_SEARCH_LENGTH = 255;

export class ListServiceUsersDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    description: 'Fragment cherché dans le nom, le prénom ou le matricule',
  })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @MaxLength(MAX_SEARCH_LENGTH)
  @IsOptional()
  search?: string;

  @ApiPropertyOptional({
    enum: UserRoleEnum,
    description: 'Filtre sur le rôle',
  })
  @IsEnum(UserRoleEnum)
  @IsOptional()
  role?: UserRoleEnum;

  @ApiPropertyOptional({
    description: 'Filtre sur le grade, à valeur exacte (cf. GET /users/grades)',
  })
  @IsString()
  @MaxLength(MAX_SEARCH_LENGTH)
  @IsOptional()
  grade?: string;

  @ApiPropertyOptional({
    enum: UserStatusEnum,
    description: "Filtre sur l'état du compte",
  })
  @IsEnum(UserStatusEnum)
  @IsOptional()
  status?: UserStatusEnum;
}
