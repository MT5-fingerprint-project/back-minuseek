import { Controller, Get, Param, Query } from '@nestjs/common';
import { QueryBus } from '@nestjs/cqrs';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ListCaseAuditEventsQuery } from '../../application/queries/list-case-audit-events/list-case-audit-events.query';
import { CaseAdministration } from '../../../access/infrastructure/http/case-scope.decorator';
import { ListCaseAuditEventsDto } from './dto/list-case-audit-events.dto';

@ApiTags('audit-trail')
@Controller('investigation-cases')
export class AuditTrailController {
  constructor(private readonly queryBus: QueryBus) {}

  @Get(':caseId/audit-events')
  @CaseAdministration()
  @ApiOperation({ summary: "Chronologie d'audit d'un dossier" })
  @ApiResponse({
    status: 200,
    description: 'Historique paginé, du plus récent au plus ancien',
  })
  @ApiResponse({
    status: 400,
    description:
      "Paramètres invalides (type d'événement inconnu, page ou limit hors bornes)",
  })
  list(@Param('caseId') caseId: string, @Query() dto: ListCaseAuditEventsDto) {
    return this.queryBus.execute(
      new ListCaseAuditEventsQuery(caseId, dto.eventType, dto.page, dto.limit),
    );
  }
}
