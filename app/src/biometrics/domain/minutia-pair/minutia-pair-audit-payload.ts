import type { MinutiaMark } from '../layer/minutia';
import type { MinutiaPair } from './entity/minutia-pair';

export type UnpairingCause = 'OPERATOR' | 'MINUTIA_DELETED';

export function minutiaPairAuditPayload(
  pair: MinutiaPair,
  traceMinutia: MinutiaMark | null,
  referenceMinutia: MinutiaMark | null,
  cause?: UnpairingCause,
): Record<string, unknown> {
  return {
    pairId: pair.id,
    traceId: pair.traceId,
    referencePrintId: pair.referencePrintId,
    traceMinutiaLayerId: pair.traceMinutiaLayerId,
    referenceMinutiaLayerId: pair.referenceMinutiaLayerId,
    traceMinutia: sideOf(traceMinutia),
    referenceMinutia: sideOf(referenceMinutia),
    ...(cause === undefined ? {} : { cause }),
  };
}

function sideOf(mark: MinutiaMark | null): Record<string, unknown> | null {
  return mark === null
    ? null
    : { x: mark.x, y: mark.y, minutiaType: mark.minutiaType };
}
