export class DisabledOperatorError extends Error {
  constructor(userId: string) {
    super(`Le compte "${userId}" est désactivé et ne peut plus être désigné`);
  }
}
