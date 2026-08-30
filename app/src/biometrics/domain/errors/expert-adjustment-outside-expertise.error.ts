export class ExpertAdjustmentOutsideExpertiseError extends Error {
  constructor(caseId: string, filterKey: string) {
    super(
      `Le réglage "${filterKey}" est réservé aux dossiers déclarés en expertise : l'affaire "${caseId}" ne l'est pas`,
    );
  }
}
