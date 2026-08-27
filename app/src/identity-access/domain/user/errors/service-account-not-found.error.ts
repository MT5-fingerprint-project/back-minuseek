export class ServiceAccountNotFoundError extends Error {
  constructor(userId: string) {
    super(`Aucun compte "${userId}" dans ce service`);
  }
}
