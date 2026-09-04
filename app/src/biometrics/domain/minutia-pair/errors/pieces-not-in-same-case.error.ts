export class PiecesNotInSameCaseError extends Error {
  constructor(traceId: string, referencePrintId: string) {
    super(
      `La trace ${traceId} et l'empreinte ${referencePrintId} ne relèvent pas du même dossier`,
    );
  }
}
