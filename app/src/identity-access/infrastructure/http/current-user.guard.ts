import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { QueryBus } from '@nestjs/cqrs';
import type { Request } from 'express';
import type { AuthenticatedUser } from '../../../auth/infrastructure/http/auth.types';
import type { TenantContext } from '../../../tenancy/application/tenant-context.service';
import { TenantContextService } from '../../../tenancy/application/tenant-context.service';
import { GetUserByProviderIdQuery } from '../../application/queries/get-user-by-provider-id/get-user-by-provider-id.query';
import { UserReadModel } from '../../application/queries/get-user-by-provider-id/user-read-model';
import { UserNotFoundError } from '../../domain/user/errors/user-not-found.error';

export type RequestWithCurrentUser = Request & {
  user?: AuthenticatedUser;
  tenantContext?: TenantContext;
  currentUser?: UserReadModel;
};

/**
 * Résout une fois par requête le compte du service derrière le `sub` du jeton
 * et le pose sur la requête, pour les gardes d'accès et l'auteur des actes.
 * Tourne après TenantGuard, qui prouve le tenant ; le contexte tenant n'existe
 * pas encore côté interceptor, on l'ouvre donc le temps de la lecture.
 *
 * Un jeton sans compte en base n'est pas refusé ici : c'est la route qui décide
 * ce qu'elle en fait.
 */
@Injectable()
export class CurrentUserGuard implements CanActivate {
  constructor(
    private readonly queryBus: QueryBus,
    private readonly tenantContext: TenantContextService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<RequestWithCurrentUser>();
    const sub = request.user?.sub;
    const tenant = request.tenantContext;

    if (!sub || !tenant) {
      return true;
    }

    request.currentUser = await this.resolve(tenant, sub);
    return true;
  }

  private async resolve(
    tenant: TenantContext,
    sub: string,
  ): Promise<UserReadModel | undefined> {
    try {
      return await this.tenantContext.run(tenant, () =>
        this.queryBus.execute<GetUserByProviderIdQuery, UserReadModel>(
          new GetUserByProviderIdQuery(sub),
        ),
      );
    } catch (error) {
      if (error instanceof UserNotFoundError) {
        return undefined;
      }
      throw error;
    }
  }
}
