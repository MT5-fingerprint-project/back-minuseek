export class InvalidCaseExpertiseError extends Error {
  constructor(field: string) {
    super(`Une déclaration d'expertise exige un "${field}" non vide`);
  }
}
