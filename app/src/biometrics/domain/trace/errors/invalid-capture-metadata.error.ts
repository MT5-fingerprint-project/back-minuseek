export class InvalidCaptureMetadataError extends Error {
  constructor(reason: string) {
    super(`Métadonnées de capture invalides : ${reason}`);
  }
}
