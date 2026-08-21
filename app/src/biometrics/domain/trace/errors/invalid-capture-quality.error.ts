export class InvalidCaptureQualityError extends Error {
  constructor(reason: string) {
    super(`Contrôle qualité de capture invalide : ${reason}`);
  }
}
