export class NotAMinutiaLayerError extends Error {
  constructor(layerId: string) {
    super(`Le calque ${layerId} n'est pas une minutie`);
  }
}
