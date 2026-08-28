export class CaseNotOpenForWorkError extends Error {
  constructor(caseId: string) {
    super(
      `L'affaire "${caseId}" est close : elle n'accepte plus aucune modification`,
    );
  }
}
