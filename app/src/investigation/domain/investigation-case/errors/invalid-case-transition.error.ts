export class InvalidCaseTransitionError extends Error {
  constructor(from: string, to: string) {
    super(`Une affaire "${from}" ne peut pas passer à "${to}"`);
  }
}
