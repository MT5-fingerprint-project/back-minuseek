import { CaseSaisineChanges } from './entity/case-expertise';

export function saisinePayload(
  changes: CaseSaisineChanges,
): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(changes).map(([field, value]) => [
      field,
      value instanceof Date ? value.toISOString() : value,
    ]),
  );
}
