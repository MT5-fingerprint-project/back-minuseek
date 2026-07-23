export class UserNotFoundError extends Error {
  constructor(identityProviderId: string) {
    super(
      `Aucun utilisateur trouvé pour l'identity provider id "${identityProviderId}"`,
    );
  }
}
