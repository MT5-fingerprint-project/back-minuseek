import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Put,
} from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { NoCaseScope } from '../../../access/infrastructure/http/case-scope.decorator';
import { CurrentUser } from '../../../auth/infrastructure/http/current-user.decorator';
import { AuthenticatedUser } from '../../../auth/infrastructure/http/auth.types';
import { toAuditActor } from '../../../auth/infrastructure/http/audit-actor.mapper';
import { CurrentServiceUser } from '../../../identity-access/infrastructure/http/current-service-user.decorator';
import { UserReadModel } from '../../../identity-access/application/queries/get-user-by-provider-id/user-read-model';
import { UserRoleEnum } from '../../../identity-access/domain/user/value-objects/user-role.vo';
import { SaveServiceSettingsCommand } from '../../application/commands/save-service-settings/save-service-settings.command';
import { GetServiceSettingsQuery } from '../../application/queries/get-service-settings/get-service-settings.query';
import { ServiceSettingsReadModel } from '../../application/queries/get-service-settings/service-settings-read-model';
import { ServiceSettingsAdministrationNotAllowedError } from '../../domain/service-settings/errors/service-settings-administration-not-allowed.error';
import { SaveServiceSettingsDto } from './save-service-settings.dto';

const NO_SERVICE_ACCOUNT_MESSAGE =
  "Aucun compte de service n'est rattaché à ce jeton";

const NO_CASE_SCOPE_REASON = 'réglage de service, hors périmètre affaire';

@ApiTags('service-settings')
@Controller('service-settings')
export class ServiceSettingsController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
  ) {}

  @Get()
  @NoCaseScope(NO_CASE_SCOPE_REASON)
  @ApiOperation({ summary: "Lire l'en-tête du service courant" })
  @ApiResponse({
    status: 200,
    description: "En-tête du service ; vide tant que rien n'a été saisi",
  })
  @ApiResponse({
    status: 404,
    description: "Le jeton n'a pas de compte dans ce service",
  })
  async get(
    @CurrentServiceUser() requester?: UserReadModel,
  ): Promise<ServiceSettingsReadModel> {
    if (!requester) throw new NotFoundException(NO_SERVICE_ACCOUNT_MESSAGE);

    return await this.queryBus.execute<
      GetServiceSettingsQuery,
      ServiceSettingsReadModel
    >(new GetServiceSettingsQuery());
  }

  @Put()
  @NoCaseScope(NO_CASE_SCOPE_REASON)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Enregistrer l'en-tête du service courant" })
  @ApiResponse({ status: 204, description: 'En-tête enregistré' })
  @ApiResponse({ status: 403, description: "L'appelant n'est pas responsable" })
  @ApiResponse({
    status: 404,
    description: "Le jeton n'a pas de compte dans ce service",
  })
  async save(
    @Body() dto: SaveServiceSettingsDto,
    @CurrentUser() user: AuthenticatedUser,
    @CurrentServiceUser() requester?: UserReadModel,
  ): Promise<void> {
    if (!requester) throw new NotFoundException(NO_SERVICE_ACCOUNT_MESSAGE);

    try {
      await this.commandBus.execute<SaveServiceSettingsCommand, void>(
        new SaveServiceSettingsCommand(
          toAuditActor(user),
          { id: requester.id, role: requester.role as UserRoleEnum },
          {
            administration: dto.administration,
            serviceName: dto.serviceName,
            postalAddress: dto.postalAddress,
            phoneNumber: dto.phoneNumber,
            email: dto.email,
            signatureCity: dto.signatureCity,
          },
        ),
      );
    } catch (error) {
      if (error instanceof ServiceSettingsAdministrationNotAllowedError) {
        throw new ForbiddenException(error.message);
      }
      throw error;
    }
  }
}
