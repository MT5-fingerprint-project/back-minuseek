import {
  Body,
  ConflictException,
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
import { ReportSequenceAlreadyTakenError } from '../../domain/report/errors/report-sequence-already-taken.error';
import { CaseScoped } from '../../../access/infrastructure/http/case-scope.decorator';
import { CurrentServiceUser } from '../../../identity-access/infrastructure/http/current-service-user.decorator';
import type { UserReadModel } from '../../../identity-access/application/queries/get-user-by-provider-id/user-read-model';
import { GenerateReportDto } from './dto/generate-report.dto';

const NO_SERVICE_ACCOUNT_MESSAGE =
  "Aucun compte de service n'est rattaché à ce jeton : le rapport ne peut pas être signé";

@ApiTags('reports')
@Controller()
export class ReportsController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
  ) {}

  @Post('investigation-cases/:caseId/reports')
  @CaseScoped()
  @ApiOperation({ summary: 'Générer et sceller un rapport du dossier' })
  @ApiResponse({
    status: 201,
    description: 'Rapport scellé (identifiant + sha256)',
  })
  @ApiResponse({
    status: 404,
    description: 'Dossier non trouvé, ou jeton sans compte dans ce service',
  })
  @ApiResponse({
    status: 409,
    description: 'Numéro déjà pris par une génération concurrente',
  })
  async generate(
    @Param('caseId') caseId: string,
    @Body() dto: GenerateReportDto,
    @CurrentUser() user: AuthenticatedUser,
    @CurrentServiceUser() signer?: UserReadModel,
  ) {
    // On ne signe que pour soi : le signataire est le compte de l'appelant, et
    // la route n'offre aucun moyen d'en désigner un autre.
    if (!signer) throw new NotFoundException(NO_SERVICE_ACCOUNT_MESSAGE);

    try {
      return await this.commandBus.execute<
        GenerateReportCommand,
        GeneratedReport
      >(
        new GenerateReportCommand(
          toAuditActor(user),
          caseId,
          dto.type,
          {
            id: signer.id,
            grade: signer.grade,
            firstName: signer.firstName,
            lastName: signer.lastName,
            serviceNumber: signer.serviceNumber,
          },
          dto.journalDetail ?? 'SUMMARY',
        ),
      );
    } catch (e) {
      if (e instanceof CaseNotFoundForReportError)
        throw new NotFoundException(e.message);
      if (e instanceof ReportSequenceAlreadyTakenError)
        throw new ConflictException(e.message);
      throw e;
    }
  }

  @Get('investigation-cases/:caseId/reports')
  @CaseScoped()
  @ApiOperation({ summary: 'Lister les rapports scellés du dossier' })
  @ApiResponse({
    status: 200,
    description: 'Rapports du plus récent au plus ancien',
  })
  list(@Param('caseId') caseId: string) {
    return this.queryBus.execute(new ListCaseReportsQuery(caseId));
  }

  @Get('reports/:id/download')
  @CaseScoped()
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
