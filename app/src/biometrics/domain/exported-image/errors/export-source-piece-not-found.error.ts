export class ExportSourcePieceNotFoundError extends Error {
  constructor(pieceId: string) {
    super(`Aucune pièce trouvée avec l'identifiant "${pieceId}"`);
  }
}
