export class MinutiaPairNotAuthoredByVerifierError extends Error {
  constructor(id: string) {
    super(`L'appariement ${id} n'a pas été posé par ce vérificateur`);
  }
}
