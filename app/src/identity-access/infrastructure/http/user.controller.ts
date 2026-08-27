import {
  Controller,
  Get,
  NotFoundException,
  Param,
  Query,
} from '@nestjs/common';
import { QueryBus } from '@nestjs/cqrs';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { NoCaseScope } from '../../../access/infrastructure/http/case-scope.decorator';
import { GetUserByProviderIdQuery } from '../../application/queries/get-user-by-provider-id/get-user-by-provider-id.query';
import { UserReadModel } from '../../application/queries/get-user-by-provider-id/user-read-model';
import { UserNotFoundError } from '../../domain/user/errors/user-not-found.error';
import { PageDto } from '../../../shared/application/pagination/page.dto';
import { PaginationQueryDto } from '../../../shared/infrastructure/http/dto/pagination-query.dto';
import { ListUsersQuery } from '../../application/queries/list-users/list-users.query';
import { ServiceUserReadModel } from '../../application/queries/list-users/service-user-read-model';

/**
 * Lecture seule. La création d'un compte n'entre pas par ici : elle passe par
 * `POST /organizations/:slug/users`, réservée au royaume système, qui crée le
 * compte chez le fournisseur d'identité puis appelle `RegisterUserCommand`.
 */
@ApiTags('users')
@Controller('users')
export class UserController {
  constructor(private readonly queryBus: QueryBus) {}

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
}
