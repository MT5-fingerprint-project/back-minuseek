export class ReportSequenceAlreadyTakenError extends Error {
  constructor(caseId: string, sequence: number) {
    super(
      `Le numéro ${sequence} est déjà pris sur le dossier ${caseId} : relancer la génération`,
    );
    this.name = 'ReportSequenceAlreadyTakenError';
  }
}
