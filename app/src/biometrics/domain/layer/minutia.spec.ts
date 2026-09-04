import { MinutiaTypeEnum } from '../../../shared/domain/forensics/minutiae';
import { Layer, type LayerSettings, type LayerType } from './entity/layer';
import { isMinutiaLayer, minutiaMarkOf } from './minutia';

function layer(settings: LayerSettings, type: LayerType = 'ANNOTATION'): Layer {
  return Layer.create({
    id: 'layer-1',
    fingerprintId: 'fp-1',
    name: 'Point',
    type,
    zIndex: 0,
    settings,
    createdByUserId: 'user-marie',
  });
}

const MINUTIA_SETTINGS = {
  type: 'minutia',
  x: 120,
  y: 240,
  radius: 6,
  color: '#ef4444',
  angle: 90,
  minutiaType: MinutiaTypeEnum.BIFURCATION,
};

describe('isMinutiaLayer', () => {
  it.each(['circle', 'circleArrow', 'minutia'])(
    'recognises a %s annotation as a minutia',
    (settingsType) => {
      expect(
        isMinutiaLayer(layer({ ...MINUTIA_SETTINGS, type: settingsType })),
      ).toBe(true);
    },
  );

  it('refuses a free pencil stroke', () => {
    expect(isMinutiaLayer(layer({ type: 'pencil', points: [1, 2] }))).toBe(
      false,
    );
  });

  it('refuses a filter layer even when its settings look like a minutia', () => {
    expect(isMinutiaLayer(layer(MINUTIA_SETTINGS, 'FILTER'))).toBe(false);
  });

  it('refuses settings without a type', () => {
    expect(isMinutiaLayer(layer({ x: 1, y: 2 }))).toBe(false);
  });

  it('refuses a settings type that is not a string', () => {
    expect(isMinutiaLayer(layer({ type: 42 }))).toBe(false);
  });
});

describe('minutiaMarkOf', () => {
  it('reads the identifier, the coordinates and the type of a minutia', () => {
    expect(minutiaMarkOf(layer(MINUTIA_SETTINGS))).toEqual({
      layerId: 'layer-1',
      x: 120,
      y: 240,
      minutiaType: MinutiaTypeEnum.BIFURCATION,
    });
  });

  it('reads a point posed before the type existed as undetermined', () => {
    expect(
      minutiaMarkOf(
        layer({ type: 'circle', x: 5, y: 6, radius: 4, color: '#000000' }),
      ).minutiaType,
    ).toBe(MinutiaTypeEnum.UNDETERMINED);
  });

  it('reads a type outside the catalogue as undetermined', () => {
    expect(
      minutiaMarkOf(layer({ ...MINUTIA_SETTINGS, minutiaType: 'CROCHET' }))
        .minutiaType,
    ).toBe(MinutiaTypeEnum.UNDETERMINED);
  });

  it('does not take a prototype member for a type', () => {
    expect(
      minutiaMarkOf(layer({ ...MINUTIA_SETTINGS, minutiaType: 'toString' }))
        .minutiaType,
    ).toBe(MinutiaTypeEnum.UNDETERMINED);
  });

  it('gives no coordinates when the settings carry none', () => {
    expect(minutiaMarkOf(layer({ type: 'circle' }))).toEqual({
      layerId: 'layer-1',
      x: null,
      y: null,
      minutiaType: MinutiaTypeEnum.UNDETERMINED,
    });
  });

  it('gives no coordinates when they are not numbers', () => {
    expect(minutiaMarkOf(layer({ type: 'circle', x: '5', y: null }))).toEqual({
      layerId: 'layer-1',
      x: null,
      y: null,
      minutiaType: MinutiaTypeEnum.UNDETERMINED,
    });
  });
});
