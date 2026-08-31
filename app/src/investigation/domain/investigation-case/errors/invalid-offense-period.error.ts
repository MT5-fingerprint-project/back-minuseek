export class InvalidOffensePeriodError extends Error {
  constructor() {
    super(
      'La fin de la période des faits ne peut pas précéder la date des faits, et une fin de période suppose une date de début',
    );
  }
}
