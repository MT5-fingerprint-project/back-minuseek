export class RecipientBookEntryNotFoundError extends Error {
  constructor(id: string) {
    super(`Aucune fiche de destinataire trouvée avec l'identifiant ${id}`);
  }
}
