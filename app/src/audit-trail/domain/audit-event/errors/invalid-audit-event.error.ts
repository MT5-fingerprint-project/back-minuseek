export class InvalidAuditEventError extends Error {
  constructor(reason: string) {
    super(`Événement d'audit invalide : ${reason}`);
  }
}
