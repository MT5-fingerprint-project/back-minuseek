export class CaseNotFoundError extends Error {
  constructor(id: string) {
    super(`Aucune affaire trouvée avec l'identifiant "${id}"`);
  }
}
