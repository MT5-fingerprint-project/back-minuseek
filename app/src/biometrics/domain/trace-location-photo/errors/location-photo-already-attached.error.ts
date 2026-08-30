export class LocationPhotoAlreadyAttachedError extends Error {
  constructor(traceId: string) {
    super(
      `La trace ${traceId} porte déjà une photographie de localisation : ` +
        'retirer la précédente avant d’en verser une autre',
    );
  }
}
