import { PieceData } from '../../ports/case-report-data.reader';

const NO_TREATMENT = 'Aucun';

function signedPercent(value: number): string {
  return `${value < 0 ? '−' : '+'}${Math.abs(value)} %`;
}

function treatmentLabel(filterKey: string, value: number): string | null {
  switch (filterKey) {
    case 'inversion':
      return 'Inversion';
    case 'mirror':
      return 'Miroir';
    default:
      break;
  }
  if (!Number.isFinite(value)) {
    return null;
  }
  switch (filterKey) {
    case 'brightness':
      return `Luminosité ${signedPercent(value)}`;
    case 'contrast':
      return `Contraste ${signedPercent(value)}`;
    case 'saturation':
      return `Saturation ${signedPercent(value)}`;
    case 'rotation':
      return `Rotation ${value < 0 ? '−' : ''}${Math.abs(value)}°`;
    default:
      return null;
  }
}

function lowerFirst(value: string): string {
  return value.charAt(0).toLowerCase() + value.slice(1);
}

export function treatmentsOf(piece: PieceData): string {
  const labels = piece.layers
    .filter((layer) => layer.type === 'FILTER')
    .sort((left, right) => left.zIndex - right.zIndex)
    .map((layer) =>
      treatmentLabel(
        String(layer.settings.filterKey),
        Number(layer.settings.value),
      ),
    )
    .filter((label): label is string => label !== null);

  if (labels.length === 0) {
    return NO_TREATMENT;
  }
  return labels
    .map((label, order) => (order === 0 ? label : lowerFirst(label)))
    .join(', ');
}
