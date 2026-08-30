export class InvalidTraceLocationError extends Error {
  constructor(reason: string) {
    super(`Localisation de trace invalide : ${reason}`);
  }
}
