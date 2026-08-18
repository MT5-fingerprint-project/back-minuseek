// error raised when trying to save an image to storage that already exists
//original cannot be overwritten (ADR-0009, point 6)
export class ImageAlreadyStoredError extends Error {
  constructor(storedPath: string) {
    super(
      `Un objet existe déjà sous la clé ${storedPath} : l'original d'une pièce est immuable`,
    );
  }
}
