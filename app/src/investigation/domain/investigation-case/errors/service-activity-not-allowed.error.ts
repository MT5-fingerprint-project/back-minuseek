export class ServiceActivityNotAllowedError extends Error {
  constructor() {
    super(
      'Seul un responsable de service peut lire les chiffres de son service',
    );
  }
}
