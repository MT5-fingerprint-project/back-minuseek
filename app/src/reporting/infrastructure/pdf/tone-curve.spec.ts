import { buildCurveLut } from './tone-curve';

const IDENTITY = [
  { x: 0, y: 0 },
  { x: 255, y: 255 },
];

describe('buildCurveLut', () => {
  it('laisse les 256 niveaux en place sur la diagonale', () => {
    const lut = buildCurveLut(IDENTITY);

    expect([...lut]).toEqual([...Array(256).keys()]);
  });

  it('passe exactement par ses points de contrôle', () => {
    const lut = buildCurveLut([
      { x: 0, y: 0 },
      { x: 90, y: 170 },
      { x: 255, y: 255 },
    ]);

    expect(lut[0]).toBe(0);
    expect(lut[90]).toBe(170);
    expect(lut[255]).toBe(255);
  });

  it('reste croissante entre deux points, sans rebond', () => {
    const lut = buildCurveLut([
      { x: 0, y: 0 },
      { x: 40, y: 10 },
      { x: 200, y: 245 },
      { x: 255, y: 255 },
    ]);

    for (let level = 1; level < 256; level += 1) {
      expect(lut[level]).toBeGreaterThanOrEqual(lut[level - 1]);
    }
  });

  it('prolonge à plat au-delà du premier et du dernier point', () => {
    const lut = buildCurveLut([
      { x: 60, y: 20 },
      { x: 200, y: 240 },
    ]);

    expect(lut[0]).toBe(20);
    expect(lut[59]).toBe(20);
    expect(lut[201]).toBe(240);
    expect(lut[255]).toBe(240);
  });

  it('écrase tous les niveaux sur la sortie d’un point unique', () => {
    const lut = buildCurveLut([{ x: 128, y: 42 }]);

    expect([...new Set(lut)]).toEqual([42]);
  });

  it('rend la diagonale quand aucun point n’est posé', () => {
    expect(buildCurveLut([])[128]).toBe(128);
  });

  it('ne retient qu’un point par niveau d’entrée', () => {
    const lut = buildCurveLut([
      { x: 0, y: 0 },
      { x: 128, y: 50 },
      { x: 128, y: 200 },
      { x: 255, y: 255 },
    ]);

    expect(lut[128]).toBe(200);
  });
});
