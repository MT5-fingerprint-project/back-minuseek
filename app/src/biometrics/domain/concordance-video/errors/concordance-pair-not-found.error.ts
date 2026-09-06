export class ConcordancePairNotFoundError extends Error {
  constructor(traceId: string, referencePrintId: string) {
    super(
      `Aucun couple trace "${traceId}" / empreinte de référence "${referencePrintId}" dans ce dossier`,
    );
  }
}
