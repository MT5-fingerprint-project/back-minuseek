import { countByAgeBracket } from './age-bracket';

describe('countByAgeBracket', () => {
  it('ne compte rien quand aucun dossier n est ouvert', () => {
    expect(countByAgeBracket([])).toEqual({
      overSixMonths: 0,
      threeToSixMonths: 0,
      underThreeMonths: 0,
    });
  });

  it('répartit les douze dossiers de la démonstration en deux, deux et huit', () => {
    const ages = [213, 187, 141, 96, 74, 68, 41, 33, 27, 19, 12, 5];

    expect(countByAgeBracket(ages)).toEqual({
      overSixMonths: 2,
      threeToSixMonths: 2,
      underThreeMonths: 8,
    });
  });

  it('range quatre-vingt-onze jours dans la tranche de trois à six mois', () => {
    expect(countByAgeBracket([91])).toEqual({
      overSixMonths: 0,
      threeToSixMonths: 1,
      underThreeMonths: 0,
    });
  });

  it('range quatre-vingt-dix jours dans la tranche de moins de trois mois', () => {
    expect(countByAgeBracket([90])).toEqual({
      overSixMonths: 0,
      threeToSixMonths: 0,
      underThreeMonths: 1,
    });
  });

  it('range cent quatre-vingt-deux jours dans la tranche de trois à six mois', () => {
    expect(countByAgeBracket([182])).toEqual({
      overSixMonths: 0,
      threeToSixMonths: 1,
      underThreeMonths: 0,
    });
  });

  it('range cent quatre-vingt-trois jours au-delà de six mois', () => {
    expect(countByAgeBracket([183])).toEqual({
      overSixMonths: 1,
      threeToSixMonths: 0,
      underThreeMonths: 0,
    });
  });

  it('compte un dossier ouvert le jour même', () => {
    expect(countByAgeBracket([0])).toEqual({
      overSixMonths: 0,
      threeToSixMonths: 0,
      underThreeMonths: 1,
    });
  });

  it('ne perd aucun dossier : la somme des tranches vaut le nombre de dossiers', () => {
    const ages = [400, 183, 182, 91, 90, 0, 7, 250];
    const counted = countByAgeBracket(ages);

    expect(
      counted.overSixMonths +
        counted.threeToSixMonths +
        counted.underThreeMonths,
    ).toBe(ages.length);
  });
});
