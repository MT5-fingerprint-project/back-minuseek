import { formatDay } from '../../report-dates';

export function bornPhrase(
  sex: string,
  birthDate: Date | null,
  birthPlace: string | null,
): string | null {
  const place =
    birthPlace !== null && birthPlace.length > 0 ? birthPlace : null;
  if (birthDate === null && place === null) {
    return null;
  }
  return [
    sex === 'FEMALE' ? 'née' : 'né',
    birthDate === null ? null : `le ${formatDay(birthDate)}`,
    place === null ? null : `à ${place}`,
  ]
    .filter((part): part is string => part !== null)
    .join(' ');
}
