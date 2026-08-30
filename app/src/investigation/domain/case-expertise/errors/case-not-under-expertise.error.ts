export class CaseNotUnderExpertiseError extends Error {
  constructor(caseId: string) {
    super(`L'affaire "${caseId}" n'est pas déclarée en expertise`);
  }
}
