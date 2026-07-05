import { IsEnum, IsOptional } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationQueryDto } from '../../../../shared/infrastructure/http/dto/pagination-query.dto';
import { InvestigationCaseStatusEnum } from '../../../domain/investigation-case/value-objects/investigation-case-status.vo';

export class ListInvestigationCasesDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    description: "Filtre sur le statut de l'affaire",
    enum: InvestigationCaseStatusEnum,
  })
  @IsEnum(InvestigationCaseStatusEnum)
  @IsOptional()
  status?: InvestigationCaseStatusEnum;
}
