import {
  Body,
  ConflictException,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  HttpCode,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UnprocessableEntityException,
} from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CreateMinutiaPairCommand } from '../../application/commands/create-minutia-pair/create-minutia-pair.command';
import { RemoveMinutiaPairCommand } from '../../application/commands/remove-minutia-pair/remove-minutia-pair.command';
import { ListMinutiaPairsQuery } from '../../application/queries/list-minutia-pairs/list-minutia-pairs.query';
import type { MinutiaPairReadModel } from '../../application/queries/list-minutia-pairs/minutia-pair-read-model';
import { CaseNotOpenForWorkError } from '../../domain/errors/case-not-open-for-work.error';
import { FingerprintNotFoundError } from '../../domain/fingerprint-not-found.error';
import { LayerNotAuthoredByVerifierError } from '../../domain/layer/errors/layer-not-authored-by-verifier.error';
import { LayerNotFoundError } from '../../domain/layer/errors/layer-not-found.error';
import { IncompatibleMinutiaTypesError } from '../../domain/minutia-pair/errors/incompatible-minutia-types.error';
import { MinutiaOutsidePieceError } from '../../domain/minutia-pair/errors/minutia-outside-piece.error';
import { MinutiaPairAlreadyExistsError } from '../../domain/minutia-pair/errors/minutia-pair-already-exists.error';
import { MinutiaPairNotAuthoredByVerifierError } from '../../domain/minutia-pair/errors/minutia-pair-not-authored-by-verifier.error';
import { MinutiaPairNotFoundError } from '../../domain/minutia-pair/errors/minutia-pair-not-found.error';
import { NotAMinutiaLayerError } from '../../domain/minutia-pair/errors/not-a-minutia-layer.error';
import { PiecesNotInSameCaseError } from '../../domain/minutia-pair/errors/pieces-not-in-same-case.error';
import { CaseUnavailableForTraceError } from '../../domain/trace/errors/case-unavailable-for-trace.error';
import { CreateMinutiaPairDto } from './dto/create-minutia-pair.dto';
import { ListMinutiaPairsDto } from './dto/list-minutia-pairs.dto';
import { CurrentUser } from '../../../auth/infrastructure/http/current-user.decorator';
import { AuthenticatedUser } from '../../../auth/infrastructure/http/auth.types';
import { toAuditActor } from '../../../auth/infrastructure/http/audit-actor.mapper';
import { CaseScoped } from '../../../access/infrastructure/http/case-scope.decorator';
import {
  BlindVerifierId,
  CaseVerifierId,
} from '../../../access/infrastructure/http/blind-verifier.decorator';
import { CurrentServiceUser } from '../../../identity-access/infrastructure/http/current-service-user.decorator';
import { UserReadModel } from '../../../identity-access/application/queries/get-user-by-provider-id/user-read-model';

@ApiTags('minutia-pairs')
@Controller('traces/:id/minutia-pairs')
export class MinutiaPairsController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
  ) {}

  @Get()
  @CaseScoped()
  @ApiOperation({
    summary: 'Lister les appariements de minuties d’une comparaison',
  })
  @ApiResponse({ status: 200, description: 'Appariements ordonnés par numéro' })
  listMinutiaPairs(
    @Param('id', ParseUUIDPipe) traceId: string,
    @Query() dto: ListMinutiaPairsDto,
    @BlindVerifierId() blindVerifierUserId: string | null,
  ): Promise<MinutiaPairReadModel[]> {
    return this.queryBus.execute(
      new ListMinutiaPairsQuery(
        traceId,
        dto.referencePrintId,
        blindVerifierUserId,
      ),
    );
  }

  @Post()
  @CaseScoped()
  @ApiOperation({
    summary: 'Apparier une minutie de trace et une de référence',
  })
  @ApiResponse({ status: 201, description: 'Appariement enregistré' })
  @ApiResponse({ status: 403, description: 'Appariement d’un autre auteur' })
  @ApiResponse({ status: 404, description: 'Pièce ou calque introuvable' })
  @ApiResponse({
    status: 409,
    description: 'Affaire close, types incompatibles ou minutie déjà appariée',
  })
  @ApiResponse({
    status: 422,
    description: 'Calque qui n’est pas une minutie de la pièce visée',
  })
  async createMinutiaPair(
    @Param('id', ParseUUIDPipe) traceId: string,
    @Body() dto: CreateMinutiaPairDto,
    @CurrentUser() user: AuthenticatedUser,
    @BlindVerifierId() blindVerifierUserId: string | null,
    @CurrentServiceUser() author?: UserReadModel,
  ): Promise<MinutiaPairReadModel> {
    try {
      return await this.commandBus.execute(
        new CreateMinutiaPairCommand(
          toAuditActor(user),
          traceId,
          dto.referencePrintId,
          dto.traceMinutiaLayerId,
          dto.referenceMinutiaLayerId,
          author?.id ?? null,
          blindVerifierUserId,
        ),
      );
    } catch (e) {
      throw this.translated(e);
    }
  }

  @Delete(':pairId')
  @CaseScoped()
  @HttpCode(204)
  @ApiOperation({ summary: 'Défaire un appariement de minuties' })
  @ApiResponse({ status: 204, description: 'Appariement défait' })
  @ApiResponse({ status: 403, description: 'Appariement d’un autre auteur' })
  @ApiResponse({ status: 404, description: 'Appariement introuvable' })
  @ApiResponse({ status: 409, description: 'Affaire close' })
  async removeMinutiaPair(
    @Param('id', ParseUUIDPipe) traceId: string,
    @Param('pairId', ParseUUIDPipe) pairId: string,
    @CurrentUser() user: AuthenticatedUser,
    @CaseVerifierId() verifierUserId: string | null,
  ): Promise<void> {
    try {
      await this.commandBus.execute(
        new RemoveMinutiaPairCommand(
          toAuditActor(user),
          traceId,
          pairId,
          verifierUserId,
        ),
      );
    } catch (e) {
      throw this.translated(e);
    }
  }

  private translated(error: unknown): unknown {
    if (
      error instanceof CaseNotOpenForWorkError ||
      error instanceof IncompatibleMinutiaTypesError ||
      error instanceof MinutiaPairAlreadyExistsError
    ) {
      return new ConflictException(error.message);
    }
    if (
      error instanceof MinutiaPairNotAuthoredByVerifierError ||
      error instanceof LayerNotAuthoredByVerifierError
    ) {
      return new ForbiddenException(error.message);
    }
    if (
      error instanceof NotAMinutiaLayerError ||
      error instanceof MinutiaOutsidePieceError
    ) {
      return new UnprocessableEntityException(error.message);
    }
    if (
      error instanceof LayerNotFoundError ||
      error instanceof FingerprintNotFoundError ||
      error instanceof PiecesNotInSameCaseError ||
      error instanceof MinutiaPairNotFoundError ||
      error instanceof CaseUnavailableForTraceError
    ) {
      return new NotFoundException(error.message);
    }
    return error;
  }
}
