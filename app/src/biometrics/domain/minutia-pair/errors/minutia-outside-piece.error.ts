export class MinutiaOutsidePieceError extends Error {
  constructor(layerId: string, fingerprintId: string) {
    super(
      `La minutie ${layerId} n'est pas posée sur la pièce ${fingerprintId}`,
    );
  }
}
