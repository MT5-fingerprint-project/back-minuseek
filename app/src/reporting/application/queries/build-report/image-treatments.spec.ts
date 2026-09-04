import { PieceData } from '../../ports/case-report-data.reader';
import { geometryOf, movedByGeometry } from './image-treatments';

function piece(
  layers: { filterKey: string; value: number; isVisible?: boolean }[],
): PieceData {
  return {
    layers: layers.map((layer, index) => ({
      name: layer.filterKey,
      type: 'FILTER',
      zIndex: index,
      isVisible: layer.isVisible ?? true,
      settings: { filterKey: layer.filterKey, value: layer.value },
    })),
  } as unknown as PieceData;
}

describe('geometryOf', () => {
  it('lit la rotation enregistrée sur l’image', () => {
    expect(geometryOf(piece([{ filterKey: 'rotation', value: 90 }]))).toEqual({
      rotationDeg: 90,
      mirrored: false,
    });
  });

  it('lit le miroir enregistré sur l’image', () => {
    expect(geometryOf(piece([{ filterKey: 'mirror', value: 1 }]))).toEqual({
      rotationDeg: 0,
      mirrored: true,
    });
  });

  it('ignore un réglage masqué, que l’atelier n’applique pas non plus', () => {
    expect(
      geometryOf(
        piece([{ filterKey: 'rotation', value: 90, isVisible: false }]),
      ),
    ).toBeNull();
  });

  it('ignore les réglages de ton, qui ne déplacent aucune minutie', () => {
    expect(
      geometryOf(piece([{ filterKey: 'brightness', value: 20 }])),
    ).toBeNull();
  });

  it('ne retient aucune géométrie quand l’image n’a pas été retournée', () => {
    expect(geometryOf(piece([]))).toBeNull();
  });
});

describe('movedByGeometry', () => {
  const SOURCE = { width: 200, height: 100 };

  it('suit le quart de tour horaire appliqué à l’image', () => {
    const moved = movedByGeometry(
      { x: 30, y: 20 },
      { rotationDeg: 90, mirrored: false },
      SOURCE,
      { width: 100, height: 200 },
    );

    expect(moved.x).toBeCloseTo(79, 5);
    expect(moved.y).toBeCloseTo(30, 5);
  });

  it('suit le retournement horizontal', () => {
    const moved = movedByGeometry(
      { x: 30, y: 20 },
      { rotationDeg: 0, mirrored: true },
      SOURCE,
      SOURCE,
    );

    expect(moved.x).toBeCloseTo(169, 5);
    expect(moved.y).toBeCloseTo(20, 5);
  });

  it('retourne avant de tourner, comme l’atelier compose ses transformations', () => {
    const moved = movedByGeometry(
      { x: 30, y: 20 },
      { rotationDeg: 90, mirrored: true },
      SOURCE,
      { width: 100, height: 200 },
    );

    expect(moved.x).toBeCloseTo(79, 5);
    expect(moved.y).toBeCloseTo(169, 5);
  });

  it('laisse la minutie en place quand l’image n’a pas bougé', () => {
    const moved = movedByGeometry(
      { x: 30, y: 20 },
      { rotationDeg: 0, mirrored: false },
      SOURCE,
      SOURCE,
    );

    expect(moved).toEqual({ x: 30, y: 20 });
  });
});
