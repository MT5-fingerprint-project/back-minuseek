export class IncompleteVerificationError extends Error {
  constructor(readonly missingTraceCount: number) {
    super(
      `Il manque ${missingTraceCount} conclusion(s) de trace pour valider la vérification`,
    );
  }
}
