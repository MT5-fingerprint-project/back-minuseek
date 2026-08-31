import { percentile } from './percentile';

describe('percentile', () => {
  it("rend null sur une liste vide, parce qu'un quantile sans valeur n'existe pas", () => {
    expect(percentile([], 0.5)).toBeNull();
  });

  it('rend la valeur elle-même quand la liste en porte une seule', () => {
    expect(percentile([12], 0.5)).toBe(12);
    expect(percentile([12], 0.9)).toBe(12);
  });

  it('interpole la médiane entre les deux valeurs qui encadrent le rang', () => {
    expect(percentile([1, 2, 3, 4], 0.5)).toBe(2.5);
  });

  it('interpole le neuvième décile de dix valeurs', () => {
    expect(percentile([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 0.9)).toBeCloseTo(9.1);
  });

  it('rend la médiane exacte quand le rang tombe sur une valeur', () => {
    expect(percentile([1, 2, 3], 0.5)).toBe(2);
  });

  it("trie avant de calculer, quel que soit l'ordre reçu", () => {
    expect(percentile([4, 1, 3, 2], 0.5)).toBe(2.5);
  });

  it('compare les durées comme des nombres, pas comme des chaînes', () => {
    expect(percentile([2, 10], 0.5)).toBe(6);
  });

  it("ne modifie pas la liste qu'on lui passe", () => {
    const durees = [4, 1, 3, 2];

    percentile(durees, 0.5);

    expect(durees).toEqual([4, 1, 3, 2]);
  });
});
