export class CaseClosedError extends Error {
  constructor(caseId: string) {
    super(`L'affaire "${caseId}" est close et ne se modifie plus`);
  }
}
