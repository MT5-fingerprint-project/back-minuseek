export class InvalidUserProfileError extends Error {
  constructor(field: string) {
    super(`Le champ "${field}" d'un compte de service ne peut pas être vide`);
  }
}
