export class NotTheVerifierError extends Error {
  constructor(verificationId: string) {
    super(
      `Seul le vérificateur de la mission "${verificationId}" rend et révise ses conclusions`,
    );
  }
}
