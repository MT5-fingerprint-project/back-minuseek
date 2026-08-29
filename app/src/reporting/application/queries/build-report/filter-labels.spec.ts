import { filterSentence, signedValue } from './filter-labels';

describe('signedValue', () => {
  it.each([
    [20, ' %', '+20 %'],
    [-15, ' %', '−15 %'],
    [0, ' %', '+0 %'],
    [90, '°', '90°'],
    [-12, '°', '−12°'],
  ])('rend %p en %p → %p', (value, unit, expected) => {
    expect(signedValue(value, unit)).toBe(expected);
  });
});

describe('filterSentence', () => {
  it.each([
    ['brightness', 20, 'Luminosité portée à +20 %'],
    ['contrast', 15, 'Contraste porté à +15 %'],
    ['saturation', -40, 'Saturation portée à −40 %'],
    ['rotation', 12, 'Rotation portée à 12°'],
  ])('dit la pose du réglage %p', (key, value, expected) => {
    expect(filterSentence(key, value, 'applied')).toBe(expected);
  });

  it.each([
    ['inversion', 'Inversion appliquée'],
    ['mirror', 'Effet miroir appliqué'],
  ])('dit la pose de l’interrupteur %p', (key, expected) => {
    expect(filterSentence(key, 1, 'applied')).toBe(expected);
  });

  it.each([
    ['brightness', 'Réglage de luminosité retiré'],
    ['rotation', 'Rotation retirée'],
    ['mirror', 'Effet miroir retiré'],
  ])('dit le retrait du réglage %p', (key, expected) => {
    expect(filterSentence(key, 20, 'removed')).toBe(expected);
  });

  it.each([
    ['contrast', 'Réglage de contraste masqué'],
    ['inversion', 'Inversion masquée'],
  ])('dit le masquage du réglage %p', (key, expected) => {
    expect(filterSentence(key, 20, 'hidden')).toBe(expected);
  });

  it('couvre les six réglages du produit', () => {
    const covered = [
      'brightness',
      'contrast',
      'saturation',
      'rotation',
      'inversion',
      'mirror',
    ];

    for (const key of covered) {
      expect(filterSentence(key, 10, 'applied')).not.toContain('«');
    }
  });

  it('nomme une clé inconnue au lieu de jeter', () => {
    expect(filterSentence('sepia', 10, 'applied')).toBe(
      "Réglage d'affichage « sepia » modifié",
    );
  });

  it('nomme aussi une clé absente plutôt que d’échouer', () => {
    expect(filterSentence(undefined, 10, 'applied')).toBe(
      "Réglage d'affichage « undefined » modifié",
    );
  });

  it('se passe de la valeur quand le payload n’en porte pas de lisible', () => {
    expect(filterSentence('brightness', 'beaucoup', 'applied')).toBe(
      'Luminosité portée',
    );
  });
});
