export class SubjectNotFoundError extends Error {
  constructor(id: string) {
    super(`Aucun sujet trouvé pour l'id "${id}"`);
  }
}
