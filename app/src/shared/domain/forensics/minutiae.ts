/**
 * Règle de concordance minimale appliquée à la déclaration d'un hit. Le rapport
 * technique la cite : c'est elle qui fait de la planche une démonstration, et
 * non une juxtaposition d'images.
 */
export const REQUIRED_MINUTIAE = 12;

export const MINUTIA_SETTINGS_TYPES = [
  'circle',
  'circleArrow',
  'minutiae',
] as const;

export type MinutiaSettingsType = (typeof MINUTIA_SETTINGS_TYPES)[number];
