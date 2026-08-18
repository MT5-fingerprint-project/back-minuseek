import {
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  Post,
} from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AuthenticatedUser } from '../../../auth/infrastructure/http/auth.types';
import { toAuditActor } from '../../../auth/infrastructure/http/audit-actor.mapper';
import { CurrentUser } from '../../../auth/infrastructure/http/current-user.decorator';
import { GenerateReportCommand } from '../../application/commands/generate-report/generate-report.command';
import type { GeneratedReport } from '../../application/commands/generate-report/generate-report.handler';
import { GetReportDownloadUrlQuery } from '../../application/queries/get-report-download-url/get-report-download-url.query';
import { ListCaseReportsQuery } from '../../application/queries/list-case-reports/list-case-reports.query';
import { CaseNotFoundForReportError } from '../../domain/report/errors/case-not-found-for-report.error';
import { ReportNotFoundError } from '../../domain/report/errors/report-not-found.error';
import { GenerateReportDto } from './dto/generate-report.dto';

@ApiTags('reports')
@Controller()
export class ReportsController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
  ) {}

  @Post('investigation-cases/:caseId/reports')
  @ApiOperation({ summary: 'Générer et sceller un rapport du dossier' })
  @ApiResponse({
    status: 201,
    description: 'Rapport scellé (identifiant + sha256)',
  })
  @ApiResponse({ status: 404, description: 'Dossier non trouvé' })
  async generate(
    @Param('caseId') caseId: string,
    @Body() dto: GenerateReportDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    try {
      return await this.commandBus.execute<
        GenerateReportCommand,
        GeneratedReport
      >(new GenerateReportCommand(toAuditActor(user), caseId, dto.type));
    } catch (e) {
      if (e instanceof CaseNotFoundForReportError)
        throw new NotFoundException(e.message);
      throw e;
    }
  }

  @Get('investigation-cases/:caseId/reports')
  @ApiOperation({ summary: 'Lister les rapports scellés du dossier' })
  @ApiResponse({
    status: 200,
    description: 'Rapports du plus récent au plus ancien',
  })
  list(@Param('caseId') caseId: string) {
    return this.queryBus.execute(new ListCaseReportsQuery(caseId));
  }

  @Get('reports/:id/download')
  @ApiOperation({
    summary: 'URL signée de téléchargement du rapport, avec son empreinte',
  })
  @ApiResponse({
    status: 200,
    description: 'URL signée V4 et sha256 du document',
  })
  @ApiResponse({ status: 404, description: 'Rapport non trouvé' })
  async download(@Param('id') id: string) {
    try {
      return await this.queryBus.execute<
        GetReportDownloadUrlQuery,
        { url: string; sha256: string }
      >(new GetReportDownloadUrlQuery(id));
    } catch (e) {
      if (e instanceof ReportNotFoundError)
        throw new NotFoundException(e.message);
      throw e;
    }
  }
}
