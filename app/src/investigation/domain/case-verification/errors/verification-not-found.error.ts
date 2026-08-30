export class VerificationNotFoundError extends Error {
  constructor(id: string) {
    super(`Aucune vérification trouvée avec l'identifiant "${id}"`);
  }
}
