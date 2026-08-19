import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  FileTypeValidator,
  Get,
  MaxFileSizeValidator,
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
  ValidationPipe,
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
import { InvalidImageError } from '../../application/ports/image-converter.port';
import { UnsupportedImageFormatError } from '../../application/services/displayable-image';
import { MatchingPrimitives } from '../../domain/matching/entity/matching';
import { CurrentUser } from '../../../auth/infrastructure/http/current-user.decorator';
import { AuthenticatedUser } from '../../../auth/infrastructure/http/auth.types';
import { toAuditActor } from '../../../auth/infrastructure/http/audit-actor.mapper';
import { DeletePieceDto } from './dto/delete-piece.dto';
import { UploadTraceDto } from './dto/upload-trace.dto';
import { UploadReferencePrintDto } from './dto/upload-reference-print.dto';
import { ListTracesDto } from './dto/list-traces.dto';
import { ListReferencePrintsDto } from './dto/list-reference-prints.dto';
import { CompareTraceDto } from './dto/compare-trace.dto';
import { RecordHitDto } from './dto/record-hit.dto';

const IMAGE_MIME = /^image\/(png|jpe?g|tiff)$/;
const MAX_IMAGE_SIZE_BYTES = 20 * 1024 * 1024;

const statedReason = (dto: DeletePieceDto): string | null =>
  dto.reason?.trim() || null;

// Les champs d'un multipart arrivent tous en chaîne : ce pipe local active
// `transform` pour que le contrôleur reçoive des nombres. Le pipe global de
// `main.ts` ne le fait pas, et l'y activer changerait toutes les routes.
const captureMetadataPipe = () =>
  new ValidationPipe({
    transform: true,
    whitelist: true,
    forbidNonWhitelisted: true,
  });

const imageFileValidator = () =>
  new ParseFilePipe({
    validators: [
      new FileTypeValidator({ fileType: IMAGE_MIME }),
      new MaxFileSizeValidator({ maxSize: MAX_IMAGE_SIZE_BYTES }),
    ],
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
  async deleteTrace(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() dto: DeletePieceDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    try {
      await this.commandBus.execute(
        new DeleteTraceCommand(toAuditActor(user), id, statedReason(dto)),
      );
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
  async deleteReferencePrint(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() dto: DeletePieceDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    try {
      await this.commandBus.execute(
        new DeleteReferencePrintCommand(
          toAuditActor(user),
          id,
          statedReason(dto),
        ),
      );
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
        width: { type: 'integer', minimum: 1, example: 3024 },
        height: { type: 'integer', minimum: 1, example: 4032 },
        capturedAt: {
          type: 'string',
          format: 'date-time',
          example: '2026-08-18T10:12:00.000Z',
        },
        orientation: { type: 'integer', minimum: 1, maximum: 8, example: 6 },
        focalLength: { type: 'number', example: 6.86 },
        deviceModel: {
          type: 'string',
          maxLength: 120,
          example: 'iPhone 14 Pro',
        },
      },
      required: ['file', 'caseId'],
    },
  })
  @ApiResponse({ status: 201, description: 'Trace uploadée et persistée' })
  @ApiResponse({
    status: 400,
    description:
      'Fichier manquant, type non supporté (PNG/JPEG/TIFF), au-delà de 20 Mo, caseId invalide, ' +
      'métadonnées de capture invalides (dimensions non appairées, orientation hors 1–8, ' +
      'focale négative, capturedAt non ISO 8601) ou champ inconnu',
  })
  @ApiResponse({
    status: 404,
    description:
      'Affaire inexistante ou non accessible (statut ≠ OPEN/IN_PROGRESS)',
  })
  @UseInterceptors(FileInterceptor('file'))
  async uploadTrace(
    @UploadedFile(imageFileValidator())
    file: { buffer: Buffer },
    @Body(captureMetadataPipe()) dto: UploadTraceDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    try {
      return await this.commandBus.execute<
        UploadTraceCommand,
        { id: string; path: string; url: string }
      >(
        new UploadTraceCommand(toAuditActor(user), file.buffer, dto.caseId, {
          width: dto.width,
          height: dto.height,
          capturedAt: dto.capturedAt,
          orientation: dto.orientation,
          focalLength: dto.focalLength,
          deviceModel: dto.deviceModel,
        }),
      );
    } catch (e) {
      if (e instanceof CaseUnavailableForTraceError)
        throw new NotFoundException(e.message);
      if (
        e instanceof InvalidImageError ||
        e instanceof UnsupportedImageFormatError
      )
        throw new BadRequestException(e.message);
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
        subjectId: { type: 'string', format: 'uuid' },
        position: { type: 'string' },
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
      'Fichier manquant, type non supporté (PNG/JPEG/TIFF), au-delà de 20 Mo, caseId/subjectId ou position invalide',
  })
  @UseInterceptors(FileInterceptor('file'))
  async uploadReferencePrint(
    @UploadedFile(imageFileValidator())
    file: { buffer: Buffer },
    @Body() dto: UploadReferencePrintDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    try {
      return await this.commandBus.execute<
        UploadReferencePrintCommand,
        { id: string; path: string; url: string }
      >(
        new UploadReferencePrintCommand(
          toAuditActor(user),
          file.buffer,
          dto.caseId,
          dto.subjectId,
          dto.position,
        ),
      );
    } catch (e) {
      if (
        e instanceof InvalidImageError ||
        e instanceof UnsupportedImageFormatError
      )
        throw new BadRequestException(e.message);
      throw e;
    }
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
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ matchings: MatchingPrimitives[] }> {
    try {
      const matchings = await this.commandBus.execute<
        CompareTraceCommand,
        MatchingPrimitives[]
      >(
        new CompareTraceCommand(
          toAuditActor(user),
          dto.caseId,
          traceId,
          dto.referencePrintIds,
        ),
      );
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
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<void> {
    const declaredByUserId = await this.resolveUserId(user);
    try {
      await this.commandBus.execute(
        new RecordHitCommand(
          toAuditActor(user),
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
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<void> {
    try {
      await this.commandBus.execute(
        new RemoveHitCommand(
          toAuditActor(user),
          caseId,
          traceId,
          referencePrintId,
        ),
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
