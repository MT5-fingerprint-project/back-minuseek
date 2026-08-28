import { groupExaminedTraces, traceReference } from './trace-grouping';

const POWDER = 'FINGERPRINT_POWDER';

function trace(
  number: number,
  location: string,
  origin = 'DIGITAL',
  revelationTechnique: string | null = POWDER,
) {
  return { number, location, origin, revelationTechnique };
}

describe('traceReference', () => {
  it('ne reformate pas le numéro d’affaire', () => {
    expect(traceReference('2026-00042', 50)).toBe('2026-00042-T50');
  });
});

describe('groupExaminedTraces', () => {
  it('laisse une trace isolée sur sa propre ligne', () => {
    const groups = groupExaminedTraces('3455', [trace(1, 'Sur la porte')]);

    expect(groups).toHaveLength(1);
    expect(groups[0].label).toBe('3455-T1');
  });

  it('écrit « et » pour deux traces consécutives identiques', () => {
    const groups = groupExaminedTraces('3455', [
      trace(5, 'Sur la commode'),
      trace(6, 'Sur la commode'),
    ]);

    expect(groups).toHaveLength(1);
    expect(groups[0].label).toBe('3455-T5 et T6');
  });

  it('écrit « à » à partir de trois traces consécutives identiques', () => {
    const groups = groupExaminedTraces('3455', [
      trace(1, 'Sur la porte-fenêtre'),
      trace(2, 'Sur la porte-fenêtre'),
      trace(3, 'Sur la porte-fenêtre'),
    ]);

    expect(groups).toHaveLength(1);
    expect(groups[0].label).toBe('3455-T1 à T3');
  });

  it('sépare deux traces de même localisation mais d’origine différente', () => {
    const groups = groupExaminedTraces('3455', [
      trace(1, 'Sur la porte-fenêtre', 'DIGITAL'),
      trace(2, 'Sur la porte-fenêtre', 'PALMAR'),
    ]);

    expect(groups.map((group) => group.label)).toEqual(['3455-T1', '3455-T2']);
  });

  it('sépare deux traces de même localisation révélées différemment', () => {
    const groups = groupExaminedTraces('3455', [
      trace(8, 'Sur une enveloppe', 'DIGITAL', 'DFO'),
      trace(9, 'Sur une enveloppe', 'DIGITAL', 'NINHYDRIN'),
    ]);

    expect(groups.map((group) => group.label)).toEqual(['3455-T8', '3455-T9']);
  });

  it('sépare deux traces identiques dont les rangs ne se suivent pas', () => {
    const groups = groupExaminedTraces('3455', [
      trace(1, 'Sur la porte'),
      trace(3, 'Sur la porte'),
    ]);

    expect(groups.map((group) => group.label)).toEqual(['3455-T1', '3455-T3']);
  });

  it('regroupe dans l’ordre des rangs, quel que soit l’ordre reçu', () => {
    const groups = groupExaminedTraces('3455', [
      trace(2, 'Sur la porte'),
      trace(1, 'Sur la porte'),
    ]);

    expect(groups.map((group) => group.label)).toEqual(['3455-T1 et T2']);
  });

  it('regroupe des traces non renseignées sans inventer de valeur', () => {
    const groups = groupExaminedTraces('3455', [
      { number: 1, location: null, origin: null, revelationTechnique: null },
      { number: 2, location: null, origin: null, revelationTechnique: null },
    ]);

    expect(groups).toHaveLength(1);
    expect(groups[0]).toMatchObject({
      label: '3455-T1 et T2',
      location: null,
      origin: null,
      revelationTechnique: null,
    });
  });
});
