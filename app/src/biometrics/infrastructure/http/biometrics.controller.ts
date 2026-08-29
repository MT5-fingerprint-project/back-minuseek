import {
  BadRequestException,
  Body,
  Controller,
  ConflictException,
  Delete,
  FileTypeValidator,
  Get,
  MaxFileSizeValidator,
  HttpCode,
  NotFoundException,
  Param,
  ParseFilePipe,
  ParseUUIDPipe,
  Patch,
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
import { CalibrateTraceCommand } from '../../application/commands/calibrate-trace/calibrate-trace.command';
import { CalibrateReferencePrintCommand } from '../../application/commands/calibrate-reference-print/calibrate-reference-print.command';
import { UploadReferencePrintCommand } from '../../application/commands/upload-reference-print/upload-reference-print.command';
import { WithdrawTraceCommand } from '../../application/commands/withdraw-trace/withdraw-trace.command';
import { RestoreTraceCommand } from '../../application/commands/restore-trace/restore-trace.command';
import { RestoreReferencePrintCommand } from '../../application/commands/restore-reference-print/restore-reference-print.command';
import { WithdrawReferencePrintCommand } from '../../application/commands/withdraw-reference-print/withdraw-reference-print.command';
import { CompareTraceCommand } from '../../application/commands/compare-trace/compare-trace.command';
import { RecordHitCommand } from '../../application/commands/record-hit/record-hit.command';
import { RemoveHitCommand } from '../../application/commands/remove-hit/remove-hit.command';
import { ListTracesQuery } from '../../application/queries/list-traces/list-traces.query';
import { ListReferencePrintsQuery } from '../../application/queries/list-reference-prints/list-reference-prints.query';
import { ListHitsQuery } from '../../application/queries/list-hits/list-hits.query';
import { CurrentServiceUser } from '../../../identity-access/infrastructure/http/current-service-user.decorator';
import type { UserReadModel } from '../../../identity-access/application/queries/get-user-by-provider-id/user-read-model';
import { TraceNotFoundError } from '../../domain/trace/errors/trace-not-found.error';
import { CaseUnavailableForTraceError } from '../../domain/trace/errors/case-unavailable-for-trace.error';
import { ReferencePrintNotFoundError } from '../../domain/reference-print/errors/reference-print-not-found.error';
import { InsufficientMinutiaeError } from '../../domain/hit/errors/insufficient-minutiae.error';
import { CaseNotOpenForWorkError } from '../../domain/errors/case-not-open-for-work.error';
import { ReferencePrintImageDestroyedError } from '../../domain/reference-print/errors/reference-print-image-destroyed.error';
import { AlreadyWithdrawnError } from '../../domain/withdrawal/errors/already-withdrawn.error';
import { NotWithdrawnError } from '../../domain/withdrawal/errors/not-withdrawn.error';
import { InvalidImageResolutionError } from '../../domain/image-resolution.vo';
import { InvalidImageError } from '../../application/ports/image-converter.port';
import { UnsupportedImageFormatError } from '../../application/services/displayable-image';
import { MatchingPrimitives } from '../../domain/matching/entity/matching';
import { CurrentUser } from '../../../auth/infrastructure/http/current-user.decorator';
import { AuthenticatedUser } from '../../../auth/infrastructure/http/auth.types';
import { toAuditActor } from '../../../auth/infrastructure/http/audit-actor.mapper';
import { WithdrawPieceDto } from './dto/withdraw-piece.dto';
import { CalibrateImageDto } from './dto/calibrate-image.dto';
import { UploadTraceDto } from './dto/upload-trace.dto';
import { UploadReferencePrintDto } from './dto/upload-reference-print.dto';
import { ListTracesDto } from './dto/list-traces.dto';
import { ListReferencePrintsDto } from './dto/list-reference-prints.dto';
import { CompareTraceDto } from './dto/compare-trace.dto';
import { RecordHitDto } from './dto/record-hit.dto';
import {
  CaseScopeCheckedInHandler,
  CaseScoped,
} from '../../../access/infrastructure/http/case-scope.decorator';
import { UserRoleEnum } from '../../../identity-access/domain/user/value-objects/user-role.vo';
import type { CaseRequester } from '../../../access/application/case-access.service';
import { CaseAccessDeniedError } from '../../../access/application/case-access-denied.error';
import { CASE_NOT_FOUND_MESSAGE } from '../../../access/infrastructure/http/case-access.guard';

const IMAGE_MIME = /^image\/(png|jpe?g|tiff)$/;
const MAX_IMAGE_SIZE_BYTES = 20 * 1024 * 1024;

/** Le corps multipart échappe au garde : c'est le handler qui contrôle, et un
 * jeton sans compte dans le service ne dépose rien. */
const caseRequesterOf = (user?: UserReadModel): CaseRequester | null =>
  user ? { id: user.id, role: user.role as UserRoleEnum } : null;

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
  @CaseScoped()
  @ApiOperation({ summary: "Lister les traces d'un dossier" })
  @ApiResponse({ status: 200, description: 'Liste des traces du dossier' })
  @ApiResponse({ status: 400, description: 'caseId manquant ou invalide' })
  listTraces(@Query() dto: ListTracesDto) {
    return this.queryBus.execute(
      new ListTracesQuery(dto.caseId, dto.withdrawn === 'true'),
    );
  }

  @Get('reference-prints')
  @CaseScoped()
  @ApiOperation({ summary: "Lister les empreintes de référence d'un dossier" })
  @ApiResponse({
    status: 200,
    description: 'Liste des empreintes de référence du dossier',
  })
  @ApiResponse({ status: 400, description: 'caseId manquant ou invalide' })
  listReferencePrints(@Query() dto: ListReferencePrintsDto) {
    return this.queryBus.execute(
      new ListReferencePrintsQuery(dto.caseId, dto.withdrawn === 'true'),
    );
  }

  @Post('traces/:id/withdraw')
  @CaseScoped()
  @HttpCode(204)
  @ApiOperation({ summary: 'Retirer une trace du dossier' })
  @ApiResponse({ status: 204, description: 'Trace retirée du dossier' })
  @ApiResponse({ status: 400, description: 'Motif absent ou hors liste' })
  @ApiResponse({ status: 404, description: 'Trace non trouvée' })
  @ApiResponse({ status: 409, description: 'Trace déjà retirée' })
  async withdrawTrace(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: WithdrawPieceDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    try {
      await this.commandBus.execute(
        new WithdrawTraceCommand(toAuditActor(user), id, dto.motive),
      );
    } catch (e) {
      if (e instanceof CaseNotOpenForWorkError)
        throw new ConflictException(e.message);
      if (e instanceof ReferencePrintImageDestroyedError)
        throw new ConflictException(e.message);
      if (e instanceof TraceNotFoundError)
        throw new NotFoundException(e.message);
      if (e instanceof AlreadyWithdrawnError)
        throw new ConflictException(e.message);
      throw e;
    }
  }

  @Post('reference-prints/:id/withdraw')
  @CaseScoped()
  @HttpCode(204)
  @ApiOperation({ summary: 'Retirer une empreinte de référence du dossier' })
  @ApiResponse({
    status: 204,
    description: 'Empreinte de référence retirée du dossier',
  })
  @ApiResponse({ status: 400, description: 'Motif absent ou hors liste' })
  @ApiResponse({
    status: 404,
    description: 'Empreinte de référence non trouvée',
  })
  @ApiResponse({ status: 409, description: 'Empreinte déjà retirée' })
  async withdrawReferencePrint(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: WithdrawPieceDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    try {
      await this.commandBus.execute(
        new WithdrawReferencePrintCommand(toAuditActor(user), id, dto.motive),
      );
    } catch (e) {
      if (e instanceof CaseNotOpenForWorkError)
        throw new ConflictException(e.message);
      if (e instanceof ReferencePrintImageDestroyedError)
        throw new ConflictException(e.message);
      if (e instanceof ReferencePrintNotFoundError)
        throw new NotFoundException(e.message);
      if (e instanceof AlreadyWithdrawnError)
        throw new ConflictException(e.message);
      throw e;
    }
  }

  @Post('traces/:id/restore')
  @CaseScoped()
  @HttpCode(204)
  @ApiOperation({ summary: 'Rétablir une trace retirée du dossier' })
  @ApiResponse({ status: 204, description: 'Trace rétablie au dossier' })
  @ApiResponse({ status: 404, description: 'Trace non trouvée' })
  @ApiResponse({ status: 409, description: "La trace n'était pas retirée" })
  async restoreTrace(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    try {
      await this.commandBus.execute(
        new RestoreTraceCommand(toAuditActor(user), id),
      );
    } catch (e) {
      if (e instanceof CaseNotOpenForWorkError)
        throw new ConflictException(e.message);
      if (e instanceof ReferencePrintImageDestroyedError)
        throw new ConflictException(e.message);
      if (e instanceof TraceNotFoundError)
        throw new NotFoundException(e.message);
      if (e instanceof NotWithdrawnError)
        throw new ConflictException(e.message);
      throw e;
    }
  }

  @Post('reference-prints/:id/restore')
  @CaseScoped()
  @HttpCode(204)
  @ApiOperation({
    summary: 'Rétablir une empreinte de référence retirée du dossier',
  })
  @ApiResponse({
    status: 204,
    description: 'Empreinte de référence rétablie au dossier',
  })
  @ApiResponse({
    status: 404,
    description: 'Empreinte de référence non trouvée',
  })
  @ApiResponse({ status: 409, description: "L'empreinte n'était pas retirée" })
  async restoreReferencePrint(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    try {
      await this.commandBus.execute(
        new RestoreReferencePrintCommand(toAuditActor(user), id),
      );
    } catch (e) {
      if (e instanceof CaseNotOpenForWorkError)
        throw new ConflictException(e.message);
      if (e instanceof ReferencePrintImageDestroyedError)
        throw new ConflictException(e.message);
      if (e instanceof ReferencePrintNotFoundError)
        throw new NotFoundException(e.message);
      if (e instanceof NotWithdrawnError)
        throw new ConflictException(e.message);
      throw e;
    }
  }

  @Patch('traces/:id/calibration')
  @CaseScoped()
  @HttpCode(204)
  @ApiOperation({ summary: 'Calibrer la résolution de la trace' })
  @ApiResponse({ status: 204, description: 'Résolution enregistrée' })
  @ApiResponse({
    status: 400,
    description: 'Résolution non numérique ou hors intervalle 50–10 000',
  })
  @ApiResponse({ status: 404, description: 'Trace non trouvée' })
  async calibrateTrace(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CalibrateImageDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    try {
      await this.commandBus.execute(
        new CalibrateTraceCommand(toAuditActor(user), id, dto.resolutionDpi),
      );
    } catch (e) {
      if (e instanceof TraceNotFoundError)
        throw new NotFoundException(e.message);
      if (e instanceof InvalidImageResolutionError)
        throw new BadRequestException(e.message);
      throw e;
    }
  }

  @Patch('reference-prints/:id/calibration')
  @CaseScoped()
  @HttpCode(204)
  @ApiOperation({
    summary: "Calibrer la résolution de l'empreinte de référence",
  })
  @ApiResponse({ status: 204, description: 'Résolution enregistrée' })
  @ApiResponse({
    status: 400,
    description: 'Résolution non numérique ou hors intervalle 50–10 000',
  })
  @ApiResponse({
    status: 404,
    description: 'Empreinte de référence non trouvée',
  })
  async calibrateReferencePrint(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CalibrateImageDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    try {
      await this.commandBus.execute(
        new CalibrateReferencePrintCommand(
          toAuditActor(user),
          id,
          dto.resolutionDpi,
        ),
      );
    } catch (e) {
      if (e instanceof ReferencePrintNotFoundError)
        throw new NotFoundException(e.message);
      if (e instanceof InvalidImageResolutionError)
        throw new BadRequestException(e.message);
      throw e;
    }
  }

  @Post('traces')
  @CaseScopeCheckedInHandler('corps multipart non lisible par un garde')
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
        captureQuality: {
          type: 'string',
          description:
            'Contrôle de netteté relevé au déclenchement, sérialisé en JSON : ' +
            '{ blurScore: number >= 0, passed: boolean }',
          example: '{"blurScore":128.4,"passed":true}',
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
      'focale négative, capturedAt non ISO 8601), captureQuality mal formé (JSON invalide, ' +
      'blurScore négatif, passed non booléen) ou champ inconnu',
  })
  @ApiResponse({
    status: 404,
    description:
      'Affaire inexistante ou non accessible (statut ≠ OPEN/IN_PROGRESS)',
  })
  @ApiResponse({ status: 409, description: 'Affaire close' })
  @UseInterceptors(FileInterceptor('file'))
  async uploadTrace(
    @UploadedFile(imageFileValidator())
    file: { buffer: Buffer },
    @Body(captureMetadataPipe()) dto: UploadTraceDto,
    @CurrentUser() user: AuthenticatedUser,
    @CurrentServiceUser() requester?: UserReadModel,
  ) {
    try {
      return await this.commandBus.execute<
        UploadTraceCommand,
        { id: string; path: string; url: string }
      >(
        new UploadTraceCommand(
          toAuditActor(user),
          caseRequesterOf(requester),
          file.buffer,
          dto.caseId,
          {
            width: dto.width,
            height: dto.height,
            capturedAt: dto.capturedAt,
            orientation: dto.orientation,
            focalLength: dto.focalLength,
            deviceModel: dto.deviceModel,
          },
          dto.captureQuality,
        ),
      );
    } catch (e) {
      if (e instanceof CaseNotOpenForWorkError)
        throw new ConflictException(e.message);
      if (e instanceof ReferencePrintImageDestroyedError)
        throw new ConflictException(e.message);
      if (e instanceof CaseAccessDeniedError)
        throw new NotFoundException(CASE_NOT_FOUND_MESSAGE);
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
  @CaseScopeCheckedInHandler('corps multipart non lisible par un garde')
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
  @ApiResponse({ status: 409, description: 'Affaire close' })
  @UseInterceptors(FileInterceptor('file'))
  async uploadReferencePrint(
    @UploadedFile(imageFileValidator())
    file: { buffer: Buffer },
    @Body() dto: UploadReferencePrintDto,
    @CurrentUser() user: AuthenticatedUser,
    @CurrentServiceUser() requester?: UserReadModel,
  ) {
    try {
      return await this.commandBus.execute<
        UploadReferencePrintCommand,
        { id: string; path: string; url: string }
      >(
        new UploadReferencePrintCommand(
          toAuditActor(user),
          caseRequesterOf(requester),
          file.buffer,
          dto.caseId,
          dto.subjectId,
          dto.position,
        ),
      );
    } catch (e) {
      if (e instanceof CaseNotOpenForWorkError)
        throw new ConflictException(e.message);
      if (e instanceof ReferencePrintImageDestroyedError)
        throw new ConflictException(e.message);
      if (e instanceof CaseAccessDeniedError)
        throw new NotFoundException(CASE_NOT_FOUND_MESSAGE);
      if (
        e instanceof InvalidImageError ||
        e instanceof UnsupportedImageFormatError
      )
        throw new BadRequestException(e.message);
      throw e;
    }
  }

  @Post('traces/:id/compare')
  @CaseScoped()
  @ApiOperation({
    summary:
      'Comparer une trace avec des empreintes de référence et persister les scores',
  })
  @ApiResponse({ status: 201, description: 'Scores calculés et enregistrés' })
  @ApiResponse({
    status: 404,
    description: 'Trace ou empreinte de référence introuvable pour ce dossier',
  })
  @ApiResponse({ status: 409, description: 'Affaire close' })
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
      if (e instanceof CaseNotOpenForWorkError)
        throw new ConflictException(e.message);
      if (e instanceof ReferencePrintImageDestroyedError)
        throw new ConflictException(e.message);
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
  @CaseScoped()
  @ApiOperation({
    summary:
      'Déclarer un hit : cette empreinte de référence correspond à cette trace',
  })
  @ApiResponse({ status: 201, description: 'Hit enregistré' })
  @ApiResponse({
    status: 404,
    description: 'Trace ou empreinte de référence introuvable pour ce dossier',
  })
  @ApiResponse({ status: 409, description: 'Affaire close' })
  @ApiResponse({
    status: 422,
    description:
      'Moins de 12 minuties posées sur la trace ou sur l’empreinte de référence',
  })
  async recordHit(
    @Param('id', ParseUUIDPipe) traceId: string,
    @Body() dto: RecordHitDto,
    @CurrentUser() user: AuthenticatedUser,
    @CurrentServiceUser() serviceUser?: UserReadModel,
  ): Promise<void> {
    const declaredByUserId = serviceUser?.id ?? null;
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
      if (e instanceof CaseNotOpenForWorkError)
        throw new ConflictException(e.message);
      if (e instanceof ReferencePrintImageDestroyedError)
        throw new ConflictException(e.message);
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
  @CaseScoped()
  @HttpCode(204)
  @ApiOperation({ summary: 'Retirer un hit précédemment déclaré' })
  @ApiResponse({ status: 204, description: 'Hit retiré' })
  @ApiResponse({
    status: 404,
    description: 'Trace ou empreinte de référence introuvable pour ce dossier',
  })
  @ApiResponse({ status: 409, description: 'Affaire close' })
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
      if (e instanceof CaseNotOpenForWorkError)
        throw new ConflictException(e.message);
      if (e instanceof ReferencePrintImageDestroyedError)
        throw new ConflictException(e.message);
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
  @CaseScoped()
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
}
