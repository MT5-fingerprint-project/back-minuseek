export class AlreadyWithdrawnError extends Error {
  constructor(pieceId: string) {
    super(`La pièce "${pieceId}" est déjà retirée du dossier`);
  }
}
