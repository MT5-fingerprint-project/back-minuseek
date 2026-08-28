export class NotWithdrawnError extends Error {
  constructor(pieceId: string) {
    super(`La pièce "${pieceId}" n'est pas retirée du dossier`);
  }
}
