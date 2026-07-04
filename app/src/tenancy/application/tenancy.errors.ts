/** Accès DB demandé hors de tout contexte tenant : fail-closed, il n'existe
 * aucune base « par défaut » (docs/multitenancy.md §4). */
export class NoTenantInContextError extends Error {
  constructor() {
    super('No tenant in the current execution context');
  }
}

/** Le slug ne correspond à aucun tenant prêt dans le registre. */
export class TenantUnavailableError extends Error {
  constructor(slug: string) {
    super(`Tenant is not available: ${slug}`);
  }
}
