import { QueryBus } from '@nestjs/cqrs';
import { GetUserByProviderIdQuery } from './get-user-by-provider-id.query';
import { UserReadModel } from './user-read-model';

/**
 * Résout l'id interne du User (identity-access) à partir du `sub` du token
 * Keycloak (identityProviderId). Retourne null si le token est absent ou si
 * l'utilisateur n'est pas (encore) enregistré : l'action métier n'est jamais
 * bloquée par l'absence de ce rattachement.
 */
export async function resolveUserId(
  queryBus: QueryBus,
  sub: string | undefined,
): Promise<string | null> {
  if (!sub) return null;
  try {
    const user = await queryBus.execute<
      GetUserByProviderIdQuery,
      UserReadModel
    >(new GetUserByProviderIdQuery(sub));
    return user.id;
  } catch {
    return null;
  }
}
