import { ExpertAdjustmentOutsideExpertiseError } from './errors/expert-adjustment-outside-expertise.error';
import type { LayerSettings } from './layer/entity/layer';

const EXPERT_FILTER_KEYS = [
  'channelRed',
  'channelGreen',
  'channelBlue',
  'levelsBlack',
  'levelsGamma',
  'levelsWhite',
  'sharpening',
];

export function expertFilterKeyOf(
  settings: LayerSettings | undefined,
): string | null {
  const filterKey = settings?.['filterKey'];
  if (typeof filterKey !== 'string') return null;
  return EXPERT_FILTER_KEYS.includes(filterKey) ? filterKey : null;
}

export function assertExpertAdjustmentAllowed(
  caseId: string,
  settings: LayerSettings | undefined,
  isUnderExpertise: boolean,
): void {
  const filterKey = expertFilterKeyOf(settings);
  if (filterKey !== null && !isUnderExpertise) {
    throw new ExpertAdjustmentOutsideExpertiseError(caseId, filterKey);
  }
}
