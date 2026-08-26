export class UnresolvableCaseScopeError extends Error {
  constructor(route: string) {
    super(`Aucune affaire identifiable sur la route ${route}`);
  }
}
