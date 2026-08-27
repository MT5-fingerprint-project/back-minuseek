export class IdentityProviderUnavailableError extends Error {
  constructor(identityProviderId: string, cause: unknown) {
    super(
      `Le fournisseur d'identité n'a pas pu mettre à jour le compte "${identityProviderId}"`,
      { cause },
    );
  }
}
