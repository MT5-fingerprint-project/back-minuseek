export class UserAdministrationNotAllowedError extends Error {
  constructor() {
    super(
      'Seul un responsable de service peut administrer les comptes de son service',
    );
  }
}

/** Vaut dans les deux sens. Se désactiver soi-même est un accident ; se
 * réactiver soi-même est une escalade, un jeton restant valide jusqu'à son
 * expiration après la coupure. */
export class SelfStatusChangeNotAllowedError extends Error {
  constructor() {
    super(
      "Un responsable de service ne peut pas changer l'état de son propre compte",
    );
  }
}
