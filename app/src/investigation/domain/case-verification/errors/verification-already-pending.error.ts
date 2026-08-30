export class VerificationAlreadyPendingError extends Error {
  constructor(caseId: string, verifierUserId: string) {
    super(
      `Le compte "${verifierUserId}" a déjà une vérification en cours sur l'affaire "${caseId}"`,
    );
  }
}
