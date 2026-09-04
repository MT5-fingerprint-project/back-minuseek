export class MinutiaPairNotFoundError extends Error {
  constructor(id: string) {
    super(`Appariement ${id} introuvable`);
  }
}
