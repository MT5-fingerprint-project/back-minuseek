export class ReportNotFoundError extends Error {
  constructor(reportId: string) {
    super(`Aucun rapport trouvé avec l'identifiant ${reportId}`);
  }
}
