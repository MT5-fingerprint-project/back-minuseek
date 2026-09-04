import { PieceData } from '../../ports/case-report-data.reader';
import {
  geometryOf,
  movedByGeometry,
  pixelTreatmentsOf,
  treatmentOf,
} from './image-treatments';

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

describe('pixelTreatmentsOf', () => {
  it('suit l’ordre des calques, que deux traitements ne commutent pas', () => {
    expect(
      pixelTreatmentsOf(
        piece([
          { filterKey: 'saturation', value: -100 },
          { filterKey: 'contrast', value: 20 },
        ]),
      ),
    ).toEqual([
      { kind: 'SATURATION', amount: -1 },
      { kind: 'CONTRAST', amount: 0.2 },
    ]);
  });

  it('ramène le curseur à l’échelle de l’atelier', () => {
    expect(
      pixelTreatmentsOf(piece([{ filterKey: 'brightness', value: 32 }])),
    ).toEqual([{ kind: 'BRIGHTNESS', amount: 0.32 }]);
  });

  it('rassemble les trois canaux en un traitement, à la place du premier', () => {
    expect(
      pixelTreatmentsOf(
        piece([
          { filterKey: 'channelGreen', value: 1 },
          { filterKey: 'saturation', value: -100 },
          { filterKey: 'channelBlue', value: 1 },
        ]),
      ),
    ).toEqual([
      { kind: 'CHANNELS', red: false, green: true, blue: true },
      { kind: 'SATURATION', amount: -1 },
    ]);
  });

  it('rassemble les trois niveaux en un traitement, à la place du premier', () => {
    expect(
      pixelTreatmentsOf(
        piece([
          { filterKey: 'levelsGamma', value: 82 },
          { filterKey: 'levelsBlack', value: 37 },
        ]),
      ),
    ).toEqual([
      { kind: 'LEVELS', blackPoint: 0.37, whitePoint: 0, gamma: 0.82 },
    ]);
  });

  it('écarte un calque masqué et un curseur revenu au neutre', () => {
    expect(
      pixelTreatmentsOf(
        piece([
          { filterKey: 'saturation', value: -100, isVisible: false },
          { filterKey: 'contrast', value: 0 },
        ]),
      ),
    ).toEqual([]);
  });

  it('laisse la géométrie de côté : elle ne repeint aucun pixel', () => {
    expect(
      pixelTreatmentsOf(
        piece([
          { filterKey: 'rotation', value: 90 },
          { filterKey: 'mirror', value: 1 },
        ]),
      ),
    ).toEqual([]);
  });
});

describe('treatmentOf', () => {
  it('retient une pièce seulement repeinte, sans géométrie', () => {
    expect(
      treatmentOf(piece([{ filterKey: 'saturation', value: -100 }])),
    ).toEqual({
      geometry: null,
      pixels: [{ kind: 'SATURATION', amount: -1 }],
    });
  });

  it('porte les deux quand l’opérateur a repeint et retourné', () => {
    expect(
      treatmentOf(
        piece([
          { filterKey: 'saturation', value: -100 },
          { filterKey: 'rotation', value: 90 },
        ]),
      ),
    ).toEqual({
      geometry: { rotationDeg: 90, mirrored: false },
      pixels: [{ kind: 'SATURATION', amount: -1 }],
    });
  });

  it('ne retient rien quand l’atelier n’a rien enregistré', () => {
    expect(treatmentOf(piece([]))).toBeNull();
  });
});
