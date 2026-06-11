export class ReferencePrintNotFoundError extends Error {
  constructor(id: string) {
    super(`Aucune empreinte de référence trouvée avec l'identifiant "${id}"`);
  }
}
