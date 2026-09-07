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

  it.each([
    ['levelsBlack', 37, 'Point noir porté à 37 %'],
    ['levelsWhite', 12, 'Point blanc porté à 12 %'],
    ['levelsGamma', -20, 'Gamma porté à −20 %'],
    ['sharpening', 150, 'Netteté locale portée à 150 %'],
  ])(
    'dit la pose du réglage tonal %p sans lui prêter un écart',
    (key, value, expected) => {
      expect(filterSentence(key, value, 'applied')).toBe(expected);
    },
  );

  it.each([
    ['channelRed', 'Canal rouge supprimé'],
    ['channelGreen', 'Canal vert supprimé'],
    ['channelBlue', 'Canal bleu supprimé'],
  ])('dit la suppression du canal %p', (key, expected) => {
    expect(filterSentence(key, 1, 'applied')).toBe(expected);
  });

  it('énonce la courbe par ses points de contrôle', () => {
    expect(
      filterSentence(
        'curve',
        [
          { x: 0, y: 0 },
          { x: 90, y: 170 },
          { x: 255, y: 255 },
        ],
        'applied',
      ),
    ).toBe('Courbe tonale réglée sur 0 → 0, 90 → 170, 255 → 255');
  });

  it('compte les points de contrôle quand ils ne tiennent plus dans la phrase', () => {
    const points = [0, 40, 80, 120, 160, 200, 255].map((level) => ({
      x: level,
      y: level,
    }));

    expect(filterSentence('curve', points, 'applied')).toBe(
      'Courbe tonale réglée sur 7 points de contrôle',
    );
  });

  it('dit le retrait de la courbe', () => {
    expect(filterSentence('curve', [], 'removed')).toBe(
      'Courbe tonale retirée',
    );
  });

  it('couvre tous les réglages du comparateur', () => {
    const covered = [
      'brightness',
      'contrast',
      'saturation',
      'rotation',
      'inversion',
      'mirror',
      'levelsBlack',
      'levelsWhite',
      'levelsGamma',
      'channelRed',
      'channelGreen',
      'channelBlue',
      'sharpening',
      'curve',
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
