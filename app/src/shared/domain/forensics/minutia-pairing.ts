import { MinutiaTypeEnum } from './minutiae';

/**
 * Le numéro d'une paire n'est stocké nulle part : il se dérive de l'ordre de
 * pose. `createdAt` n'étant pas unique, l'identifiant ferme l'ordre — sans ce
 * départage, le comparateur et le rapport pourraient numéroter différemment.
 */
export function numberMinutiaPairs<T extends { id: string; createdAt: Date }>(
  pairs: readonly T[],
): (T & { number: number })[] {
  return [...pairs]
    .sort((left, right) => {
      const byCreation = left.createdAt.getTime() - right.createdAt.getTime();
      return byCreation !== 0 ? byCreation : left.id.localeCompare(right.id);
    })
    .map((pair, index) => ({ ...pair, number: index + 1 }));
}

export type PairTypeDecision =
  | { outcome: 'PAIRED'; type: MinutiaTypeEnum }
  | {
      outcome: 'QUALIFIES';
      type: MinutiaTypeEnum;
      sideToQualify: 'TRACE' | 'REFERENCE';
    }
  | {
      outcome: 'REFUSED';
      traceType: MinutiaTypeEnum;
      referenceType: MinutiaTypeEnum;
    };

export function resolvePairType(
  traceType: MinutiaTypeEnum,
  referenceType: MinutiaTypeEnum,
): PairTypeDecision {
  if (traceType === referenceType) {
    return { outcome: 'PAIRED', type: traceType };
  }
  if (referenceType === MinutiaTypeEnum.UNDETERMINED) {
    return {
      outcome: 'QUALIFIES',
      type: traceType,
      sideToQualify: 'REFERENCE',
    };
  }
  if (traceType === MinutiaTypeEnum.UNDETERMINED) {
    return {
      outcome: 'QUALIFIES',
      type: referenceType,
      sideToQualify: 'TRACE',
    };
  }
  return { outcome: 'REFUSED', traceType, referenceType };
}
