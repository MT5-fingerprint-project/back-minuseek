export class InvalidSaisineError extends Error {
  constructor(field: string, reason: string) {
    super(`La saisine ne peut pas être enregistrée : "${field}" ${reason}`);
  }
}
