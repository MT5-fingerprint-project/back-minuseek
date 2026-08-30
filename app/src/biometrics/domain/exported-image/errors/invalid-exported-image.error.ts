export class InvalidExportedImageError extends Error {
  constructor(reason: string) {
    super(`Image exportée invalide : ${reason}`);
  }
}
