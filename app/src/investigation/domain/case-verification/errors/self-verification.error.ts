export class SelfVerificationError extends Error {
  constructor(caseId: string) {
    super(
      `L'opérateur de l'affaire "${caseId}" ne peut pas en être le vérificateur : la vérification est un second regard`,
    );
  }
}
