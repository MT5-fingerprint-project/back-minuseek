import {
  BadGatewayException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Patch,
  Query,
} from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { NoCaseScope } from '../../../access/infrastructure/http/case-scope.decorator';
import { GetUserByProviderIdQuery } from '../../application/queries/get-user-by-provider-id/get-user-by-provider-id.query';
import { UserReadModel } from '../../application/queries/get-user-by-provider-id/user-read-model';
import { UserNotFoundError } from '../../domain/user/errors/user-not-found.error';
import { PageDto } from '../../../shared/application/pagination/page.dto';
import { PaginationQueryDto } from '../../../shared/infrastructure/http/dto/pagination-query.dto';
import { ListUsersQuery } from '../../application/queries/list-users/list-users.query';
import { ServiceUserReadModel } from '../../application/queries/list-users/service-user-read-model';
import { DeactivateUserCommand } from '../../application/commands/deactivate-user/deactivate-user.command';
import { ReactivateUserCommand } from '../../application/commands/reactivate-user/reactivate-user.command';
import { IdentityProviderUnavailableError } from '../../application/ports/identity-provider-unavailable.error';
import { ServiceAccountNotFoundError } from '../../domain/user/errors/service-account-not-found.error';
import {
  SelfStatusChangeNotAllowedError,
  UserAdministrationNotAllowedError,
} from '../../domain/user/errors/user-administration-not-allowed.error';
import { UserRoleEnum } from '../../domain/user/value-objects/user-role.vo';
import { UserStatusEnum } from '../../domain/user/value-objects/user-status.vo';
import { CurrentServiceUser } from './current-service-user.decorator';
import { ChangeUserStatusDto } from './dto/change-user-status.dto';

const NO_SERVICE_ACCOUNT_MESSAGE =
  "Aucun compte de service n'est rattaché à ce jeton";

/**
 * L'annuaire du service. La création d'un compte n'entre pas par ici : elle
 * passe par `POST /organizations/:slug/users`, réservée au royaume système.
 * Le refus de rôle se décide dans le handler, faute de garde de rôle dans le
 * dépôt.
 */
@ApiTags('users')
@Controller('users')
export class UserController {
  constructor(
    private readonly queryBus: QueryBus,
    private readonly commandBus: CommandBus,
  ) {}

  @Get()
  @NoCaseScope('annuaire du service, hors périmètre affaire')
  @ApiOperation({ summary: 'Lister les comptes du service courant' })
  @ApiResponse({ status: 200, description: 'Page de comptes du service' })
  list(
    @Query() pagination: PaginationQueryDto,
  ): Promise<PageDto<ServiceUserReadModel>> {
    return this.queryBus.execute<ListUsersQuery, PageDto<ServiceUserReadModel>>(
      new ListUsersQuery(pagination.page, pagination.limit),
    );
  }

  @Get('by-provider-id/:identityProviderId')
  @NoCaseScope('profil utilisateur, hors périmètre affaire')
  @ApiOperation({
    summary:
      'Récupérer un utilisateur par son identity provider id (sub Keycloak)',
  })
  @ApiResponse({ status: 200, description: "Détail de l'utilisateur" })
  @ApiResponse({ status: 404, description: 'Utilisateur non trouvé' })
  async getByProviderId(
    @Param('identityProviderId') identityProviderId: string,
  ): Promise<UserReadModel> {
    try {
      return await this.queryBus.execute<
        GetUserByProviderIdQuery,
        UserReadModel
      >(new GetUserByProviderIdQuery(identityProviderId));
    } catch (e) {
      if (e instanceof UserNotFoundError)
        throw new NotFoundException(e.message);
      throw e;
    }
  }

  @Patch(':id/status')
  @NoCaseScope('gestion des comptes du service, hors périmètre affaire')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Désactiver ou réactiver un compte du service' })
  @ApiResponse({ status: 204, description: 'État du compte mis à jour' })
  @ApiResponse({ status: 403, description: "L'appelant n'est pas responsable" })
  @ApiResponse({
    status: 404,
    description: 'Compte introuvable dans ce service',
  })
  @ApiResponse({
    status: 502,
    description: "Le fournisseur d'identité n'a pas pu être mis à jour",
  })
  async changeStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ChangeUserStatusDto,
    @CurrentServiceUser() requester?: UserReadModel,
  ): Promise<void> {
    if (!requester) throw new NotFoundException(NO_SERVICE_ACCOUNT_MESSAGE);
    const administrator = {
      id: requester.id,
      role: requester.role as UserRoleEnum,
    };

    try {
      await this.commandBus.execute<
        DeactivateUserCommand | ReactivateUserCommand,
        void
      >(
        dto.status === UserStatusEnum.DISABLED
          ? new DeactivateUserCommand(administrator, id)
          : new ReactivateUserCommand(administrator, id),
      );
    } catch (e) {
      throw toHttpException(e);
    }
  }
}

function toHttpException(error: unknown): unknown {
  if (
    error instanceof UserAdministrationNotAllowedError ||
    error instanceof SelfStatusChangeNotAllowedError
  ) {
    return new ForbiddenException(error.message);
  }
  if (error instanceof ServiceAccountNotFoundError) {
    return new NotFoundException(error.message);
  }
  if (error instanceof IdentityProviderUnavailableError) {
    return new BadGatewayException(error.message);
  }
  return error;
}
