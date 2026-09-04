import { MinutiaTypeEnum, minutiaTypeLabel } from './minutiae';

describe('minutiaTypeLabel', () => {
  it('names every type of the catalogue in French', () => {
    expect(
      Object.values(MinutiaTypeEnum).map((type) => [
        type,
        minutiaTypeLabel(type),
      ]),
    ).toEqual([
      [MinutiaTypeEnum.RIDGE_ENDING, 'arrêt de ligne'],
      [MinutiaTypeEnum.BIFURCATION, 'bifurcation'],
      [MinutiaTypeEnum.TRIFURCATION, 'trifurcation'],
      [MinutiaTypeEnum.ISLAND, 'îlot'],
      [MinutiaTypeEnum.ENCLOSURE, 'anneau'],
      [MinutiaTypeEnum.UNDETERMINED, 'indéterminée'],
    ]);
  });

  it('gives back a value outside the catalogue rather than inventing a label', () => {
    expect(minutiaTypeLabel('CROCHET')).toBe('CROCHET');
  });

  it('does not read a label from the prototype chain', () => {
    expect(minutiaTypeLabel('toString')).toBe('toString');
  });
});
