export class ReferencePrintImageDestroyedError extends Error {
  constructor(referencePrintId: string) {
    super(
      `L'image de l'empreinte "${referencePrintId}" a été détruite : elle ne peut plus être comparée`,
    );
  }
}
