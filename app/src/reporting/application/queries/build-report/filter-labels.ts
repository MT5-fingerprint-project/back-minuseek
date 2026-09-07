export interface FilterLabel {
  appliedTemplate: string;
  removedTemplate: string;
  hiddenTemplate: string;
  unit: string;
  /** Les réglages qui partent d'un bord ne se lisent pas en écart : pas de signe. */
  unsigned?: boolean;
}

/** Au-delà, la liste des points cesse d'être une phrase. */
const CURVE_POINTS_SPELLED_OUT = 5;

export type FilterState = 'applied' | 'removed' | 'hidden';

const CURVE_KEY = 'curve';

export const FILTER_LABELS: Record<string, FilterLabel> = {
  brightness: {
    appliedTemplate: 'Luminosité portée à {value}',
    removedTemplate: 'Réglage de luminosité retiré',
    hiddenTemplate: 'Réglage de luminosité masqué',
    unit: ' %',
  },
  contrast: {
    appliedTemplate: 'Contraste porté à {value}',
    removedTemplate: 'Réglage de contraste retiré',
    hiddenTemplate: 'Réglage de contraste masqué',
    unit: ' %',
  },
  saturation: {
    appliedTemplate: 'Saturation portée à {value}',
    removedTemplate: 'Réglage de saturation retiré',
    hiddenTemplate: 'Réglage de saturation masqué',
    unit: ' %',
  },
  rotation: {
    appliedTemplate: 'Rotation portée à {value}',
    removedTemplate: 'Rotation retirée',
    hiddenTemplate: 'Rotation masquée',
    unit: '°',
  },
  inversion: {
    appliedTemplate: 'Inversion appliquée',
    removedTemplate: 'Inversion retirée',
    hiddenTemplate: 'Inversion masquée',
    unit: '',
  },
  mirror: {
    appliedTemplate: 'Effet miroir appliqué',
    removedTemplate: 'Effet miroir retiré',
    hiddenTemplate: 'Effet miroir masqué',
    unit: '',
  },
  levelsBlack: {
    appliedTemplate: 'Point noir porté à {value}',
    removedTemplate: 'Réglage du point noir retiré',
    hiddenTemplate: 'Réglage du point noir masqué',
    unit: ' %',
    unsigned: true,
  },
  levelsWhite: {
    appliedTemplate: 'Point blanc porté à {value}',
    removedTemplate: 'Réglage du point blanc retiré',
    hiddenTemplate: 'Réglage du point blanc masqué',
    unit: ' %',
    unsigned: true,
  },
  levelsGamma: {
    appliedTemplate: 'Gamma porté à {value}',
    removedTemplate: 'Réglage du gamma retiré',
    hiddenTemplate: 'Réglage du gamma masqué',
    unit: ' %',
  },
  channelRed: {
    appliedTemplate: 'Canal rouge supprimé',
    removedTemplate: 'Suppression du canal rouge retirée',
    hiddenTemplate: 'Suppression du canal rouge masquée',
    unit: '',
  },
  channelGreen: {
    appliedTemplate: 'Canal vert supprimé',
    removedTemplate: 'Suppression du canal vert retirée',
    hiddenTemplate: 'Suppression du canal vert masquée',
    unit: '',
  },
  channelBlue: {
    appliedTemplate: 'Canal bleu supprimé',
    removedTemplate: 'Suppression du canal bleu retirée',
    hiddenTemplate: 'Suppression du canal bleu masquée',
    unit: '',
  },
  sharpening: {
    appliedTemplate: 'Netteté locale portée à {value}',
    removedTemplate: 'Réglage de netteté locale retiré',
    hiddenTemplate: 'Réglage de netteté locale masqué',
    unit: ' %',
    unsigned: true,
  },
  curve: {
    appliedTemplate: 'Courbe tonale réglée sur {value}',
    removedTemplate: 'Courbe tonale retirée',
    hiddenTemplate: 'Courbe tonale masquée',
    unit: '',
  },
};

/**
 * La courbe s'énonce par ses points de contrôle tant qu'ils tiennent dans une
 * phrase ; au-delà, le lecteur se reporte au réglage enregistré dans l'acte.
 */
export function curveDescription(points: unknown): string | null {
  if (!Array.isArray(points) || points.length < 2) {
    return null;
  }
  const read = points.filter(
    (point): point is { x: number; y: number } =>
      typeof point === 'object' &&
      point !== null &&
      typeof (point as { x?: unknown }).x === 'number' &&
      typeof (point as { y?: unknown }).y === 'number',
  );
  if (read.length !== points.length) {
    return null;
  }
  if (read.length > CURVE_POINTS_SPELLED_OUT) {
    return `${read.length} points de contrôle`;
  }
  return read.map((point) => `${point.x} → ${point.y}`).join(', ');
}

export function signedValue(value: number, unit: string): string {
  const sign = value < 0 ? '−' : '+';
  return `${unit === '°' ? (value < 0 ? '−' : '') : sign}${Math.abs(value)}${unit}`;
}

export function filterSentence(
  filterKey: unknown,
  value: unknown,
  state: FilterState,
): string {
  const key = typeof filterKey === 'string' ? filterKey : String(filterKey);
  const label = FILTER_LABELS[key];
  if (!label) {
    return `Réglage d'affichage « ${key} » modifié`;
  }
  if (state === 'removed') {
    return label.removedTemplate;
  }
  if (state === 'hidden') {
    return label.hiddenTemplate;
  }
  if (!label.appliedTemplate.includes('{value}')) {
    return label.appliedTemplate;
  }
  if (key === CURVE_KEY) {
    const description = curveDescription(value);
    return description === null
      ? label.appliedTemplate.replace(' sur {value}', '')
      : label.appliedTemplate.replace('{value}', description);
  }

  const numeric = typeof value === 'number' && Number.isFinite(value);
  if (!numeric) {
    return label.appliedTemplate.replace(' à {value}', '');
  }
  const printed = label.unsigned
    ? `${value}${label.unit}`
    : signedValue(value, label.unit);
  return label.appliedTemplate.replace('{value}', printed);
}
