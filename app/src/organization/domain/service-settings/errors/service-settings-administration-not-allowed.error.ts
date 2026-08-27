export class ServiceSettingsAdministrationNotAllowedError extends Error {
  constructor() {
    super(
      "Seul un responsable de service peut enregistrer l'en-tête de son service",
    );
  }
}
