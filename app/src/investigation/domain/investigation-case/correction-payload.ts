import { CaseCorrection } from './entity/investigation-case';

/** La sérialisation canonique du journal refuse les `Date` : elles entrent dans
 * la chaîne en ISO-8601 UTC. */
export function correctionPayload(
  correction: CaseCorrection,
): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(correction).map(([field, value]) => [
      field,
      value instanceof Date ? value.toISOString() : value,
    ]),
  );
}
