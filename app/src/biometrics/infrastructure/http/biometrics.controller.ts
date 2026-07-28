import {
  Body,
  Controller,
  Delete,
  FileTypeValidator,
  Get,
  HttpCode,
  NotFoundException,
  Param,
  ParseFilePipe,
  ParseUUIDPipe,
  Post,
  Query,
  UnprocessableEntityException,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { UploadTraceCommand } from '../../application/commands/upload-trace/upload-trace.command';
import { UploadReferencePrintCommand } from '../../application/commands/upload-reference-print/upload-reference-print.command';
import { DeleteTraceCommand } from '../../application/commands/delete-trace/delete-trace.command';
import { DeleteReferencePrintCommand } from '../../application/commands/delete-reference-print/delete-reference-print.command';
import { CompareTraceCommand } from '../../application/commands/compare-trace/compare-trace.command';
import { RecordHitCommand } from '../../application/commands/record-hit/record-hit.command';
import { RemoveHitCommand } from '../../application/commands/remove-hit/remove-hit.command';
import { ListTracesQuery } from '../../application/queries/list-traces/list-traces.query';
import { ListReferencePrintsQuery } from '../../application/queries/list-reference-prints/list-reference-prints.query';
import { ListHitsQuery } from '../../application/queries/list-hits/list-hits.query';
import { GetUserByProviderIdQuery } from '../../../identity-access/application/queries/get-user-by-provider-id/get-user-by-provider-id.query';
import { TraceNotFoundError } from '../../domain/trace/errors/trace-not-found.error';
import { CaseUnavailableForTraceError } from '../../domain/trace/errors/case-unavailable-for-trace.error';
import { ReferencePrintNotFoundError } from '../../domain/reference-print/errors/reference-print-not-found.error';
import { InsufficientMinutiaeError } from '../../domain/hit/errors/insufficient-minutiae.error';
import { MatchingPrimitives } from '../../domain/matching/entity/matching';
import { CurrentUser } from '../../../auth/infrastructure/http/current-user.decorator';
import { AuthenticatedUser } from '../../../auth/infrastructure/http/auth.types';
import { UploadTraceDto } from './dto/upload-trace.dto';
import { UploadReferencePrintDto } from './dto/upload-reference-print.dto';
import { ListTracesDto } from './dto/list-traces.dto';
import { ListReferencePrintsDto } from './dto/list-reference-prints.dto';
import { CompareTraceDto } from './dto/compare-trace.dto';
import { RecordHitDto } from './dto/record-hit.dto';

const IMAGE_MIME = /^image\/(png|jpe?g|tiff)$/;

const imageFileValidator = () =>
  new ParseFilePipe({
    validators: [new FileTypeValidator({ fileType: IMAGE_MIME })],
    fileIsRequired: true,
  });

@ApiTags('biometrics')
@Controller()
export class BiometricsController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
  ) {}

  @Get('traces')
  @ApiOperation({ summary: "Lister les traces d'un dossier" })
  @ApiResponse({ status: 200, description: 'Liste des traces du dossier' })
  @ApiResponse({ status: 400, description: 'caseId manquant ou invalide' })
  listTraces(@Query() dto: ListTracesDto) {
    return this.queryBus.execute(new ListTracesQuery(dto.caseId));
  }

  @Get('reference-prints')
  @ApiOperation({ summary: "Lister les empreintes de référence d'un dossier" })
  @ApiResponse({
    status: 200,
    description: 'Liste des empreintes de référence du dossier',
  })
  @ApiResponse({ status: 400, description: 'caseId manquant ou invalide' })
  listReferencePrints(@Query() dto: ListReferencePrintsDto) {
    return this.queryBus.execute(new ListReferencePrintsQuery(dto.caseId));
  }

  @Delete('traces/:id')
  @HttpCode(204)
  @ApiOperation({ summary: 'Supprimer une trace' })
  @ApiResponse({ status: 204, description: 'Trace supprimée' })
  @ApiResponse({ status: 404, description: 'Trace non trouvée' })
  async deleteTrace(@Param('id', ParseUUIDPipe) id: string) {
    try {
      await this.commandBus.execute(new DeleteTraceCommand(id));
    } catch (e) {
      if (e instanceof TraceNotFoundError)
        throw new NotFoundException(e.message);
      throw e;
    }
  }

  @Delete('reference-prints/:id')
  @HttpCode(204)
  @ApiOperation({ summary: 'Supprimer une empreinte de référence' })
  @ApiResponse({ status: 204, description: 'Empreinte de référence supprimée' })
  @ApiResponse({
    status: 404,
    description: 'Empreinte de référence non trouvée',
  })
  async deleteReferencePrint(@Param('id', ParseUUIDPipe) id: string) {
    try {
      await this.commandBus.execute(new DeleteReferencePrintCommand(id));
    } catch (e) {
      if (e instanceof ReferencePrintNotFoundError)
        throw new NotFoundException(e.message);
      throw e;
    }
  }

  @Post('traces')
  @ApiOperation({ summary: 'Uploader une trace papillaire' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
        caseId: { type: 'string', format: 'uuid' },
      },
      required: ['file', 'caseId'],
    },
  })
  @ApiResponse({ status: 201, description: 'Trace uploadée et persistée' })
  @ApiResponse({
    status: 400,
    description:
      'Fichier manquant, type non supporté (PNG/JPEG/TIFF) ou caseId invalide',
  })
  @ApiResponse({
    status: 404,
    description:
      'Affaire inexistante ou non accessible (statut ≠ OPEN/IN_PROGRESS)',
  })
  @UseInterceptors(FileInterceptor('file'))
  async uploadTrace(
    @UploadedFile(imageFileValidator())
    file: { buffer: Buffer; originalname: string; mimetype: string },
    @Body() dto: UploadTraceDto,
  ) {
    try {
      return await this.commandBus.execute<
        UploadTraceCommand,
        { id: string; path: string; url: string }
      >(
        new UploadTraceCommand(
          file.buffer,
          file.originalname,
          file.mimetype,
          dto.caseId,
        ),
      );
    } catch (e) {
      if (e instanceof CaseUnavailableForTraceError)
        throw new NotFoundException(e.message);
      throw e;
    }
  }

  @Post('reference-prints')
  @ApiOperation({ summary: 'Uploader une empreinte de référence' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
        caseId: { type: 'string', format: 'uuid' },
      },
      required: ['file', 'caseId'],
    },
  })
  @ApiResponse({
    status: 201,
    description: 'Empreinte de référence uploadée et persistée',
  })
  @ApiResponse({
    status: 400,
    description:
      'Fichier manquant, type non supporté (PNG/JPEG/TIFF) ou caseId invalide',
  })
  @UseInterceptors(FileInterceptor('file'))
  uploadReferencePrint(
    @UploadedFile(imageFileValidator())
    file: { buffer: Buffer; originalname: string; mimetype: string },
    @Body() dto: UploadReferencePrintDto,
  ) {
    return this.commandBus.execute<
      UploadReferencePrintCommand,
      { id: string; path: string; url: string }
    >(
      new UploadReferencePrintCommand(
        file.buffer,
        file.originalname,
        file.mimetype,
        dto.caseId,
      ),
    );
  }

  @Post('traces/:id/compare')
  @ApiOperation({
    summary:
      'Comparer une trace avec des empreintes de référence et persister les scores',
  })
  @ApiResponse({ status: 201, description: 'Scores calculés et enregistrés' })
  @ApiResponse({
    status: 404,
    description: 'Trace ou empreinte de référence introuvable pour ce dossier',
  })
  async compare(
    @Param('id', ParseUUIDPipe) traceId: string,
    @Body() dto: CompareTraceDto,
  ): Promise<{ matchings: MatchingPrimitives[] }> {
    try {
      const matchings = await this.commandBus.execute<
        CompareTraceCommand,
        MatchingPrimitives[]
      >(new CompareTraceCommand(dto.caseId, traceId, dto.referencePrintIds));
      return { matchings };
    } catch (e) {
      if (
        e instanceof TraceNotFoundError ||
        e instanceof ReferencePrintNotFoundError
      ) {
        throw new NotFoundException(e.message);
      }
      throw e;
    }
  }

  @Post('traces/:id/hit')
  @ApiOperation({
    summary:
      'Déclarer un hit : cette empreinte de référence correspond à cette trace',
  })
  @ApiResponse({ status: 201, description: 'Hit enregistré' })
  @ApiResponse({
    status: 404,
    description: 'Trace ou empreinte de référence introuvable pour ce dossier',
  })
  @ApiResponse({
    status: 422,
    description:
      'Moins de 12 minuties posées sur la trace ou sur l’empreinte de référence',
  })
  async recordHit(
    @Param('id', ParseUUIDPipe) traceId: string,
    @Body() dto: RecordHitDto,
    @CurrentUser() user?: AuthenticatedUser,
  ): Promise<void> {
    const declaredByUserId = await this.resolveUserId(user);
    try {
      await this.commandBus.execute(
        new RecordHitCommand(
          dto.caseId,
          traceId,
          dto.referencePrintId,
          declaredByUserId,
        ),
      );
    } catch (e) {
      if (
        e instanceof TraceNotFoundError ||
        e instanceof ReferencePrintNotFoundError
      ) {
        throw new NotFoundException(e.message);
      }
      if (e instanceof InsufficientMinutiaeError) {
        throw new UnprocessableEntityException(e.message);
      }
      throw e;
    }
  }

  @Delete('traces/:id/hit/:referencePrintId')
  @HttpCode(204)
  @ApiOperation({ summary: 'Retirer un hit précédemment déclaré' })
  @ApiResponse({ status: 204, description: 'Hit retiré' })
  @ApiResponse({
    status: 404,
    description: 'Trace ou empreinte de référence introuvable pour ce dossier',
  })
  async removeHit(
    @Param('id', ParseUUIDPipe) traceId: string,
    @Param('referencePrintId', ParseUUIDPipe) referencePrintId: string,
    @Query('caseId', ParseUUIDPipe) caseId: string,
  ): Promise<void> {
    try {
      await this.commandBus.execute(
        new RemoveHitCommand(caseId, traceId, referencePrintId),
      );
    } catch (e) {
      if (
        e instanceof TraceNotFoundError ||
        e instanceof ReferencePrintNotFoundError
      ) {
        throw new NotFoundException(e.message);
      }
      throw e;
    }
  }

  @Get('traces/:id/hits')
  @ApiOperation({
    summary: 'Lister les empreintes de référence en hit pour une trace',
  })
  @ApiResponse({
    status: 200,
    description: 'UUIDs des empreintes de référence en hit',
  })
  listHits(
    @Param('id', ParseUUIDPipe) traceId: string,
  ): Promise<{ referencePrintIds: string[] }> {
    return this.queryBus.execute(new ListHitsQuery(traceId));
  }

  private async resolveUserId(
    user?: AuthenticatedUser,
  ): Promise<string | null> {
    if (!user?.sub) return null;
    try {
      const found = await this.queryBus.execute<
        GetUserByProviderIdQuery,
        { id: string }
      >(new GetUserByProviderIdQuery(user.sub));
      return found.id;
    } catch {
      return null;
    }
  }
}
