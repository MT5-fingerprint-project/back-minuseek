import { PersonalData } from './personal-data.vo';

describe('PersonalData', () => {
  it('crée une PII valide et trim les espaces', () => {
    const pd = PersonalData.of({ firstName: '  Marie ', lastName: 'Curie ' });
    expect(pd.firstName).toBe('Marie');
    expect(pd.lastName).toBe('Curie');
  });

  it('lève une erreur si firstName est vide', () => {
    expect(() =>
      PersonalData.of({ firstName: '  ', lastName: 'Curie' }),
    ).toThrow('PersonalData firstName is required');
  });

  it('lève une erreur si lastName est vide', () => {
    expect(() => PersonalData.of({ firstName: 'Marie', lastName: '' })).toThrow(
      'PersonalData lastName is required',
    );
  });

  it('compare deux PII par valeur', () => {
    const a = PersonalData.of({ firstName: 'Marie', lastName: 'Curie' });
    const b = PersonalData.of({ firstName: 'Marie', lastName: 'Curie' });
    const c = PersonalData.of({ firstName: 'Pierre', lastName: 'Curie' });
    expect(a.equals(b)).toBe(true);
    expect(a.equals(c)).toBe(false);
  });
});
