export class CaseNotFoundForReportError extends Error {
  constructor(caseId: string) {
    super(`Aucun dossier ${caseId} à rapporter`);
  }
}
