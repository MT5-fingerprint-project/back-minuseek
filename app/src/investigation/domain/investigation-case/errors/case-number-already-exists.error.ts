export class CaseNumberAlreadyExistsError extends Error {
  constructor(caseNumber: string) {
    super(`Un dossier avec le numéro "${caseNumber}" existe déjà`);
  }
}
