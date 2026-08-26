export class UnknownOperatorError extends Error {
  constructor(userId: string) {
    super(`Aucun compte de service ne porte l'identifiant "${userId}"`);
  }
}
