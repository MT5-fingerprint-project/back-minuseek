export class ServiceManagerAsVerifierError extends Error {
  constructor(userId: string) {
    super(
      `Le compte "${userId}" est responsable de service : il voit le dossier entier par sa fonction, la vérification ne serait pas aveugle`,
    );
  }
}
