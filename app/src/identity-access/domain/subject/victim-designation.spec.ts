import { victimShortLabel } from './victim-designation';

describe('victimShortLabel', () => {
  it('rend le prénom et la seule initiale du nom', () => {
    expect(victimShortLabel({ firstName: 'Hélène', lastName: 'BERGER' })).toBe(
      'Hélène B.',
    );
  });

  it('ne garde qu’une initiale d’un nom en plusieurs mots', () => {
    expect(
      victimShortLabel({ firstName: 'Jean-Pierre', lastName: 'LE GOFF' }),
    ).toBe('Jean-Pierre L.');
  });

  it('met l’initiale en capitale quand le nom est saisi en minuscules', () => {
    expect(victimShortLabel({ firstName: 'Hélène', lastName: 'berger' })).toBe(
      'Hélène B.',
    );
  });

  it('garde l’accent de l’initiale', () => {
    expect(victimShortLabel({ firstName: 'Marie', lastName: 'ÉTIENNE' })).toBe(
      'Marie É.',
    );
  });

  it('ignore les espaces autour des champs saisis', () => {
    expect(
      victimShortLabel({ firstName: '  Hélène  ', lastName: '  BERGER ' }),
    ).toBe('Hélène B.');
  });

  it('rend le seul prénom quand le nom est vide', () => {
    expect(victimShortLabel({ firstName: 'Hélène', lastName: '   ' })).toBe(
      'Hélène',
    );
  });

  // Assertion adverse : ce que la désignation ne doit JAMAIS laisser passer
  // dans une table qui refuse UPDATE et DELETE.
  it('ne laisse jamais échapper le nom de famille au-delà de son initiale', () => {
    const designation = victimShortLabel({
      firstName: 'Hélène',
      lastName: 'BERGER',
    });

    expect(designation).not.toContain('BERGER');
    expect(designation).not.toContain('Berger');
    expect(designation).not.toContain('ERGER');
    expect(designation).not.toContain('E');
  });

  it('ne porte aucun chiffre, donc aucune date de naissance', () => {
    expect(
      victimShortLabel({ firstName: 'Jean-Pierre', lastName: 'LE GOFF' }),
    ).not.toMatch(/\d/);
  });
});
