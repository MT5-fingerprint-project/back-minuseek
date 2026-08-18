export class InvalidReportError extends Error {
  constructor(reason: string) {
    super(`Rapport invalide : ${reason}`);
  }
}
