export class TimestampAuthorityError extends Error {
  constructor(reason: string) {
    super(`Horodatage RFC 3161 impossible : ${reason}`);
  }
}
