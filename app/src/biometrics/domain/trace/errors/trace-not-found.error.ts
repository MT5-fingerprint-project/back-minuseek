export class TraceNotFoundError extends Error {
  constructor(id: string) {
    super(`Aucune trace trouvée avec l'identifiant "${id}"`);
  }
}
