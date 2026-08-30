export class CaseAlreadyUnderExpertiseError extends Error {
  constructor(caseId: string) {
    super(`L'affaire "${caseId}" est déjà déclarée en expertise`);
  }
}
