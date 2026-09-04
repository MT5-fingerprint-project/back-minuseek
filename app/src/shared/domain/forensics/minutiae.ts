/**
 * Règle de concordance minimale appliquée à la déclaration d'un hit. Le rapport
 * technique la cite : c'est elle qui fait de la planche une démonstration, et
 * non une juxtaposition d'images.
 */
export const REQUIRED_MINUTIAE = 12;

export const MINUTIA_SETTINGS_TYPES = [
  'circle',
  'circleArrow',
  'minutia',
] as const;

export type MinutiaSettingsType = (typeof MINUTIA_SETTINGS_TYPES)[number];

/**
 * Type du point caractéristique posé par l'outil point-flèche. `UNDETERMINED`
 * est une valeur à part entière (défaut), pas une absence de type.
 */
export enum MinutiaTypeEnum {
  RIDGE_ENDING = 'RIDGE_ENDING',
  BIFURCATION = 'BIFURCATION',
  TRIFURCATION = 'TRIFURCATION',
  ISLAND = 'ISLAND',
  ENCLOSURE = 'ENCLOSURE',
  UNDETERMINED = 'UNDETERMINED',
}

const MINUTIA_TYPE_LABELS = new Map<string, string>([
  [MinutiaTypeEnum.RIDGE_ENDING, 'arrêt de ligne'],
  [MinutiaTypeEnum.BIFURCATION, 'bifurcation'],
  [MinutiaTypeEnum.TRIFURCATION, 'trifurcation'],
  [MinutiaTypeEnum.ISLAND, 'îlot'],
  [MinutiaTypeEnum.ENCLOSURE, 'anneau'],
  [MinutiaTypeEnum.UNDETERMINED, 'indéterminée'],
]);

export function minutiaTypeLabel(rawType: string): string {
  return MINUTIA_TYPE_LABELS.get(rawType) ?? rawType;
}
