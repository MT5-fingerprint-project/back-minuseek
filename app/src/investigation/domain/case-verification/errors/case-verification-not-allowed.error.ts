export class CaseVerificationNotAllowedError extends Error {
  constructor(caseId: string) {
    super(
      `Seul l'opérateur de l'affaire "${caseId}" ou un responsable de service peut y confier une vérification`,
    );
  }
}
