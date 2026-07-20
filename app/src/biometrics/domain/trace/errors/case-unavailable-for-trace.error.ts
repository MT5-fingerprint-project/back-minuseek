export class CaseUnavailableForTraceError extends Error {
  constructor(caseId: string) {
    super(
      `Aucune affaire accessible avec l'identifiant "${caseId}" pour recevoir une trace`,
    );
  }
}
