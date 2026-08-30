export class TraceLocationPhotoNotFoundError extends Error {
  constructor(traceId: string) {
    super(`Aucune photographie de localisation sur la trace ${traceId}`);
  }
}
