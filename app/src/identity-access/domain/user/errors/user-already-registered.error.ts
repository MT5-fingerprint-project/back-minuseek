export class UserAlreadyRegisteredError extends Error {
  constructor(identityProviderId: string) {
    super(
      `Un utilisateur existe déjà pour l'identity provider id "${identityProviderId}"`,
    );
  }
}

export class ServiceNumberAlreadyExistsError extends Error {
  constructor(serviceNumber: string) {
    super(`Le numéro de service "${serviceNumber}" est déjà utilisé`);
  }
}
