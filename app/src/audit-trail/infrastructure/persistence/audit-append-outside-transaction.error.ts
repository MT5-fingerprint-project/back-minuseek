export class AuditAppendOutsideTransactionError extends Error {
  constructor(eventType: string) {
    super(
      `Append de "${eventType}" hors de toute transaction : le maillon d'audit doit partager la transaction de la mutation métier`,
    );
  }
}
