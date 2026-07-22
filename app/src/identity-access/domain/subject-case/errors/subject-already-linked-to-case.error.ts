export class SubjectAlreadyLinkedToCaseError extends Error {
  constructor(subjectId: string, caseId: string) {
    super(`Le sujet "${subjectId}" est déjà rattaché à l'affaire "${caseId}"`);
  }
}
