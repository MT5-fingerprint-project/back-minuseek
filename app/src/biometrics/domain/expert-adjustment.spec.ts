import { ExpertAdjustmentOutsideExpertiseError } from './errors/expert-adjustment-outside-expertise.error';
import {
  assertExpertAdjustmentAllowed,
  expertFilterKeyOf,
} from './expert-adjustment';

const EXPERT_KEYS = [
  'channelRed',
  'channelGreen',
  'channelBlue',
  'levelsBlack',
  'levelsGamma',
  'levelsWhite',
  'sharpening',
];

const ORDINARY_KEYS = [
  'brightness',
  'contrast',
  'saturation',
  'inversion',
  'mirror',
  'rotation',
];

describe('expertFilterKeyOf', () => {
  it.each(EXPERT_KEYS)('reconnaît le réglage %s', (filterKey) => {
    expect(expertFilterKeyOf({ filterKey, value: 40 })).toBe(filterKey);
  });

  it.each(ORDINARY_KEYS)('laisse passer le réglage %s', (filterKey) => {
    expect(expertFilterKeyOf({ filterKey, value: 40 })).toBeNull();
  });

  it("ne voit aucun réglage dans les settings d'une annotation", () => {
    expect(expertFilterKeyOf({ type: 'circle', x: 1, y: 2 })).toBeNull();
  });

  it('ne voit aucun réglage quand la commande ne porte pas de settings', () => {
    expect(expertFilterKeyOf(undefined)).toBeNull();
  });

  it("ignore un filterKey qui n'est pas une chaîne", () => {
    expect(expertFilterKeyOf({ filterKey: 12 })).toBeNull();
  });
});

describe('assertExpertAdjustmentAllowed', () => {
  it('refuse un réglage d’expert hors expertise', () => {
    expect(() =>
      assertExpertAdjustmentAllowed(
        'case-9',
        { filterKey: 'levelsGamma', value: 30 },
        false,
      ),
    ).toThrow(ExpertAdjustmentOutsideExpertiseError);
  });

  it('nomme la règle et le réglage refusé', () => {
    expect(() =>
      assertExpertAdjustmentAllowed(
        'case-9',
        { filterKey: 'sharpening', value: 30 },
        false,
      ),
    ).toThrow(/"sharpening".*expertise.*"case-9"/s);
  });

  it('accepte le même réglage sur un dossier en expertise', () => {
    expect(() =>
      assertExpertAdjustmentAllowed(
        'case-9',
        { filterKey: 'sharpening', value: 30 },
        true,
      ),
    ).not.toThrow();
  });

  it('accepte un réglage ordinaire hors expertise', () => {
    expect(() =>
      assertExpertAdjustmentAllowed(
        'case-9',
        { filterKey: 'contrast', value: 30 },
        false,
      ),
    ).not.toThrow();
  });
});
