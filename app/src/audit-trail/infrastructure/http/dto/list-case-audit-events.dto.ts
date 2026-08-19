import { IsEnum, IsOptional } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationQueryDto } from '../../../../shared/infrastructure/http/dto/pagination-query.dto';
import { AuditEventTypeEnum } from '../../../../shared/domain/audit/audit-event-type.vo';

export class ListCaseAuditEventsDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    description: "Filtre sur le type d'événement",
    enum: AuditEventTypeEnum,
  })
  @IsEnum(AuditEventTypeEnum)
  @IsOptional()
  eventType?: AuditEventTypeEnum;
}
