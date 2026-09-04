export class MinutiaPairAlreadyExistsError extends Error {
  constructor() {
    super('Une de ces deux minuties est déjà appariée sur cette comparaison');
  }
}
