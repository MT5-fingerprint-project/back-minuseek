import {
  BadGatewayException,
  BadRequestException,
  Body,
  ConflictException,
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
import { ListUserGradesQuery } from '../../application/queries/list-user-grades/list-user-grades.query';
import { ListUsersQuery } from '../../application/queries/list-users/list-users.query';
import { ServiceUserReadModel } from '../../application/queries/list-users/service-user-read-model';
import { CorrectUserProfileCommand } from '../../application/commands/correct-user-profile/correct-user-profile.command';
import { DeactivateUserCommand } from '../../application/commands/deactivate-user/deactivate-user.command';
import { ReactivateUserCommand } from '../../application/commands/reactivate-user/reactivate-user.command';
import { IdentityProviderUnavailableError } from '../../application/ports/identity-provider-unavailable.error';
import { InvalidUserProfileError } from '../../domain/user/errors/invalid-user-profile.error';
import { ServiceAccountNotFoundError } from '../../domain/user/errors/service-account-not-found.error';
import { ServiceNumberAlreadyExistsError } from '../../domain/user/errors/user-already-registered.error';
import {
  SelfStatusChangeNotAllowedError,
  UserAdministrationNotAllowedError,
} from '../../domain/user/errors/user-administration-not-allowed.error';
import { UserRoleEnum } from '../../domain/user/value-objects/user-role.vo';
import { UserStatusEnum } from '../../domain/user/value-objects/user-status.vo';
import { ServiceAccountAdministrator } from '../../application/service-account-administrator';
import { CurrentServiceUser } from './current-service-user.decorator';
import { ChangeUserStatusDto } from './dto/change-user-status.dto';
import { ListServiceUsersDto } from './dto/list-service-users.dto';
import { CorrectUserProfileDto } from './dto/correct-user-profile.dto';

const NO_SERVICE_ACCOUNT_MESSAGE =
  "Aucun compte de service n'est rattaché à ce jeton";

@ApiTags('users')
@Controller('users')
export class UserController {
  constructor(
    private readonly queryBus: QueryBus,
    private readonly commandBus: CommandBus,
  ) {}

  @Get()
  @NoCaseScope('annuaire du service, hors périmètre affaire')
  @ApiOperation({
    summary: 'Lister les comptes du service courant, filtres compris',
  })
  @ApiResponse({ status: 200, description: 'Page de comptes du service' })
  @ApiResponse({
    status: 404,
    description: "Le jeton n'a pas de compte dans ce service",
  })
  async list(
    @Query() query: ListServiceUsersDto,
    @CurrentServiceUser() requester?: UserReadModel,
  ): Promise<PageDto<ServiceUserReadModel>> {
    if (!requester) throw new NotFoundException(NO_SERVICE_ACCOUNT_MESSAGE);

    // Le filtrage se fait en base : la page rendue et son total portent la même
    // clause, sinon le nombre de pages mentirait dès le premier filtre.
    try {
      return await this.queryBus.execute<
        ListUsersQuery,
        PageDto<ServiceUserReadModel>
      >(
        new ListUsersQuery(query.page, query.limit, {
          ...(query.search ? { search: query.search } : {}),
          ...(query.role ? { role: query.role } : {}),
          ...(query.grade ? { grade: query.grade } : {}),
          ...(query.status ? { status: query.status } : {}),
        }),
      );
    } catch (e) {
      throw toHttpException(e);
    }
  }

  @Get('grades')
  @NoCaseScope('annuaire du service, hors périmètre affaire')
  @ApiOperation({
    summary: 'Lister les grades en usage dans le service, pour le filtre',
  })
  @ApiResponse({ status: 200, description: 'Grades distincts, triés' })
  @ApiResponse({
    status: 404,
    description: "Le jeton n'a pas de compte dans ce service",
  })
  async listGrades(
    @CurrentServiceUser() requester?: UserReadModel,
  ): Promise<string[]> {
    if (!requester) throw new NotFoundException(NO_SERVICE_ACCOUNT_MESSAGE);

    try {
      return await this.queryBus.execute<ListUserGradesQuery, string[]>(
        new ListUserGradesQuery(),
      );
    } catch (e) {
      throw toHttpException(e);
    }
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
    const administrator = administratorOf(requester)!;

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

  @Patch(':id/profile')
  @NoCaseScope('gestion des comptes du service, hors périmètre affaire')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Corriger le profil d'un compte du service" })
  @ApiResponse({ status: 204, description: 'Profil corrigé' })
  @ApiResponse({ status: 400, description: 'Un des quatre champs est vide' })
  @ApiResponse({ status: 403, description: "L'appelant n'est pas responsable" })
  @ApiResponse({
    status: 404,
    description: 'Compte introuvable dans ce service',
  })
  @ApiResponse({ status: 409, description: 'Matricule déjà utilisé' })
  @ApiResponse({
    status: 502,
    description: "Le fournisseur d'identité n'a pas pu être mis à jour",
  })
  async correctProfile(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CorrectUserProfileDto,
    @CurrentServiceUser() requester?: UserReadModel,
  ): Promise<void> {
    if (!requester) throw new NotFoundException(NO_SERVICE_ACCOUNT_MESSAGE);

    try {
      await this.commandBus.execute<CorrectUserProfileCommand, void>(
        new CorrectUserProfileCommand(administratorOf(requester)!, id, {
          firstName: dto.firstName,
          lastName: dto.lastName,
          grade: dto.grade,
          serviceNumber: dto.serviceNumber,
        }),
      );
    } catch (e) {
      throw toHttpException(e);
    }
  }
}

/** Le rôle vient du compte de service posé par CurrentUserGuard, jamais de la
 * requête. Absent, l'appelant est traité comme non autorisé, pas comme
 * responsable. */
function administratorOf(
  requester: UserReadModel | undefined,
): ServiceAccountAdministrator | null {
  return requester
    ? { id: requester.id, role: requester.role as UserRoleEnum }
    : null;
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
  if (error instanceof InvalidUserProfileError) {
    return new BadRequestException(error.message);
  }
  if (error instanceof ServiceNumberAlreadyExistsError) {
    return new ConflictException(error.message);
  }
  if (error instanceof IdentityProviderUnavailableError) {
    return new BadGatewayException(error.message);
  }
  return error;
}
