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
  Put,
} from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { randomUUID } from 'node:crypto';
import { CreateLayerCommand } from '../../application/commands/create-layer/create-layer.command';
import { UpdateLayerCommand } from '../../application/commands/update-layer/update-layer.command';
import { DeleteLayerCommand } from '../../application/commands/delete-layer/delete-layer.command';
import { ListLayersQuery } from '../../application/queries/list-layers/list-layers.query';
import { LayerAlreadyExistsError } from '../../domain/layer/errors/layer-already-exists.error';
import { LayerNotAuthoredByVerifierError } from '../../domain/layer/errors/layer-not-authored-by-verifier.error';
import { LayerNotFoundError } from '../../domain/layer/errors/layer-not-found.error';
import { FingerprintNotFoundError } from '../../domain/fingerprint-not-found.error';
import { CaseNotOpenForWorkError } from '../../domain/errors/case-not-open-for-work.error';
import { ExpertAdjustmentOutsideExpertiseError } from '../../domain/errors/expert-adjustment-outside-expertise.error';
import { CreateLayerDto } from './dto/create-layer.dto';
import { UpdateLayerDto } from './dto/update-layer.dto';
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

@ApiTags('layers')
@Controller('layers')
export class LayersController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
  ) {}

  @Get(':fingerprintId')
  @CaseScoped()
  @ApiOperation({ summary: "Lister les calques d'une trace ou empreinte" })
  @ApiResponse({
    status: 200,
    description: 'Liste des calques ordonnés par zIndex',
  })
  listLayers(
    @Param('fingerprintId', ParseUUIDPipe) fingerprintId: string,
    @BlindVerifierId() blindVerifierUserId: string | null,
  ) {
    return this.queryBus.execute(
      new ListLayersQuery(fingerprintId, blindVerifierUserId),
    );
  }

  @Post()
  @CaseScoped()
  @ApiOperation({ summary: 'Créer un calque' })
  @ApiResponse({ status: 201, description: 'Calque créé' })
  @ApiResponse({ status: 400, description: 'Payload invalide' })
  @ApiResponse({
    status: 403,
    description: "Réglage d'expert sur un dossier qui n'est pas en expertise",
  })
  @ApiResponse({ status: 404, description: 'Trace ou empreinte non trouvée' })
  @ApiResponse({ status: 409, description: 'Affaire close' })
  async createLayer(
    @Body() dto: CreateLayerDto,
    @CurrentUser() user: AuthenticatedUser,
    @CurrentServiceUser() author?: UserReadModel,
  ) {
    try {
      await this.commandBus.execute(
        new CreateLayerCommand(
          toAuditActor(user),
          dto.id ?? randomUUID(),
          dto.fingerprintId,
          dto.name,
          dto.type,
          dto.zIndex,
          dto.settings,
          author?.id ?? null,
        ),
      );
    } catch (e) {
      if (e instanceof CaseNotOpenForWorkError)
        throw new ConflictException(e.message);
      if (e instanceof LayerAlreadyExistsError)
        throw new ConflictException(e.message);
      if (e instanceof ExpertAdjustmentOutsideExpertiseError)
        throw new ForbiddenException(e.message);
      if (e instanceof FingerprintNotFoundError)
        throw new NotFoundException(e.message);
      throw e;
    }
  }

  @Put(':id')
  @CaseScoped()
  @ApiOperation({ summary: 'Mettre à jour un calque' })
  @ApiResponse({ status: 200, description: 'Calque mis à jour' })
  @ApiResponse({
    status: 403,
    description: "Réglage d'expert sur un dossier qui n'est pas en expertise",
  })
  @ApiResponse({ status: 404, description: 'Calque non trouvé' })
  @ApiResponse({ status: 409, description: 'Affaire close' })
  async updateLayer(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateLayerDto,
    @CurrentUser() user: AuthenticatedUser,
    @CaseVerifierId() verifierUserId: string | null,
  ) {
    try {
      await this.commandBus.execute(
        new UpdateLayerCommand(
          toAuditActor(user),
          id,
          dto.name,
          dto.zIndex,
          dto.isVisible,
          dto.settings,
          verifierUserId,
        ),
      );
    } catch (e) {
      if (e instanceof CaseNotOpenForWorkError)
        throw new ConflictException(e.message);
      if (e instanceof ExpertAdjustmentOutsideExpertiseError)
        throw new ForbiddenException(e.message);
      if (e instanceof LayerNotAuthoredByVerifierError)
        throw new ForbiddenException(e.message);
      if (
        e instanceof LayerNotFoundError ||
        e instanceof FingerprintNotFoundError
      )
        throw new NotFoundException(e.message);
      throw e;
    }
  }

  @Delete(':id')
  @CaseScoped()
  @HttpCode(204)
  @ApiOperation({ summary: 'Supprimer un calque' })
  @ApiResponse({ status: 204, description: 'Calque supprimé' })
  @ApiResponse({ status: 404, description: 'Calque non trouvé' })
  @ApiResponse({ status: 409, description: 'Affaire close' })
  async deleteLayer(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
    @CaseVerifierId() verifierUserId: string | null,
  ) {
    try {
      await this.commandBus.execute(
        new DeleteLayerCommand(toAuditActor(user), id, verifierUserId),
      );
    } catch (e) {
      if (e instanceof CaseNotOpenForWorkError)
        throw new ConflictException(e.message);
      if (e instanceof LayerNotAuthoredByVerifierError)
        throw new ForbiddenException(e.message);
      if (
        e instanceof LayerNotFoundError ||
        e instanceof FingerprintNotFoundError
      )
        throw new NotFoundException(e.message);
      throw e;
    }
  }
}
