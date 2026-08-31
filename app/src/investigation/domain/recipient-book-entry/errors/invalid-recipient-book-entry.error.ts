export class InvalidRecipientBookEntryError extends Error {
  constructor() {
    super("L'autorité destinataire est obligatoire");
  }
}
