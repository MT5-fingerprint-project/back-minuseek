export interface FilterLabel {
  appliedTemplate: string;
  removedTemplate: string;
  hiddenTemplate: string;
  unit: string;
}

export type FilterState = 'applied' | 'removed' | 'hidden';

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
};

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
  const numeric = typeof value === 'number' && Number.isFinite(value);
  return numeric
    ? label.appliedTemplate.replace('{value}', signedValue(value, label.unit))
    : label.appliedTemplate.replace(' à {value}', '');
}
