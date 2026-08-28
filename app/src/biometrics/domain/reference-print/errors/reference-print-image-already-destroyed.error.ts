export class ReferencePrintImageAlreadyDestroyedError extends Error {
  constructor(referencePrintId: string) {
    super(`L'image de l'empreinte "${referencePrintId}" est déjà détruite`);
  }
}
