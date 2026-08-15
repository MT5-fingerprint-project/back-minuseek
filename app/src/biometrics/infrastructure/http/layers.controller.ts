import {
  Body,
  Controller,
  Delete,
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
import { LayerNotFoundError } from '../../domain/layer/errors/layer-not-found.error';
import { resolveUserId } from '../../../identity-access/application/queries/get-user-by-provider-id/resolve-user-id';
import { CurrentUser } from '../../../auth/infrastructure/http/current-user.decorator';
import { AuthenticatedUser } from '../../../auth/infrastructure/http/auth.types';
import { CreateLayerDto } from './dto/create-layer.dto';
import { UpdateLayerDto } from './dto/update-layer.dto';

@ApiTags('layers')
@Controller('layers')
export class LayersController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
  ) {}

  @Get(':fingerprintId')
  @ApiOperation({ summary: "Lister les calques d'une trace ou empreinte" })
  @ApiResponse({
    status: 200,
    description: 'Liste des calques ordonnés par zIndex',
  })
  listLayers(@Param('fingerprintId', ParseUUIDPipe) fingerprintId: string) {
    return this.queryBus.execute(new ListLayersQuery(fingerprintId));
  }

  @Post()
  @ApiOperation({ summary: 'Créer un calque' })
  @ApiResponse({ status: 201, description: 'Calque créé' })
  @ApiResponse({ status: 400, description: 'Payload invalide' })
  async createLayer(
    @Body() dto: CreateLayerDto,
    @CurrentUser() user?: AuthenticatedUser,
  ) {
    const userId = await resolveUserId(this.queryBus, user?.sub);
    return this.commandBus.execute<CreateLayerCommand, void>(
      new CreateLayerCommand(
        dto.id ?? randomUUID(),
        dto.fingerprintId,
        dto.name,
        dto.type,
        dto.zIndex,
        dto.settings,
        userId,
      ),
    );
  }

  @Put(':id')
  @ApiOperation({ summary: 'Mettre à jour un calque' })
  @ApiResponse({ status: 200, description: 'Calque mis à jour' })
  @ApiResponse({ status: 404, description: 'Calque non trouvé' })
  async updateLayer(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateLayerDto,
  ) {
    try {
      await this.commandBus.execute(
        new UpdateLayerCommand(
          id,
          dto.name,
          dto.zIndex,
          dto.isVisible,
          dto.settings,
        ),
      );
    } catch (e) {
      if (e instanceof LayerNotFoundError)
        throw new NotFoundException(e.message);
      throw e;
    }
  }

  @Delete(':id')
  @HttpCode(204)
  @ApiOperation({ summary: 'Supprimer un calque' })
  @ApiResponse({ status: 204, description: 'Calque supprimé' })
  @ApiResponse({ status: 404, description: 'Calque non trouvé' })
  async deleteLayer(@Param('id', ParseUUIDPipe) id: string) {
    try {
      await this.commandBus.execute(new DeleteLayerCommand(id));
    } catch (e) {
      if (e instanceof LayerNotFoundError)
        throw new NotFoundException(e.message);
      throw e;
    }
  }
}
