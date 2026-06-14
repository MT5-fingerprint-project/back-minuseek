import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateLayerDto } from '../dto/create-layer.dto';
import { UpdateLayerDto } from '../dto/update-layer.dto';

const FP = '11111111-1111-4111-8111-111111111111';

async function settingsHasError(dto: object): Promise<boolean> {
  const errors = await validate(dto, {
    whitelist: true,
    forbidNonWhitelisted: true,
  });
  return errors.some((e) => e.property === 'settings');
}

function createDto(type: string, settings: unknown): CreateLayerDto {
  return plainToInstance(CreateLayerDto, {
    fingerprintId: FP,
    name: 'calque',
    type,
    zIndex: 0,
    settings,
  });
}

describe('IsLayerSettings (CreateLayerDto)', () => {
  const validCircle = {
    type: 'circle',
    x: 10,
    y: 20,
    radius: 4,
    color: '#ef4444',
  };
  const validArrow = {
    type: 'circleArrow',
    x: 10,
    y: 20,
    radius: 4,
    color: '#3b82f6',
    arrowEndX: 30,
    arrowEndY: 40,
  };
  const validPencil = {
    type: 'pencil',
    points: [0, 0, 5, 5, 10, 2],
    color: '#000000',
    strokeWidth: 2,
  };
  const validFilter = { filterKey: 'brightness', value: 50 };

  it.each<[string, unknown, string]>([
    ['circle', validCircle, 'ANNOTATION'],
    ['circleArrow', validArrow, 'ANNOTATION'],
    ['pencil', validPencil, 'ANNOTATION'],
    ['filter', validFilter, 'FILTER'],
  ])('accepte un payload %s valide', async (_label, settings, type) => {
    expect(await settingsHasError(createDto(type, settings))).toBe(false);
  });

  it.each<[string, unknown]>([
    ['cercle sans x', { type: 'circle', y: 20, radius: 4, color: '#ef4444' }],
    ['couleur non hexadécimale', { ...validCircle, color: 'rouge' }],
    ['type inconnu', { type: 'square', x: 1, y: 2, radius: 4, color: '#fff' }],
    ['champ en trop', { ...validCircle, evil: true }],
    ['crayon avec < 2 points', { ...validPencil, points: [0, 0] }],
    ['settings null', null],
    ['settings tableau', [1, 2, 3]],
  ])(
    'rejette un payload ANNOTATION invalide (%s)',
    async (_label, settings) => {
      expect(await settingsHasError(createDto('ANNOTATION', settings))).toBe(
        true,
      );
    },
  );

  it('rejette une forme d’annotation déclarée avec type FILTER', async () => {
    expect(await settingsHasError(createDto('FILTER', validCircle))).toBe(true);
  });
});

describe('IsLayerSettings (UpdateLayerDto, type inféré du contenu)', () => {
  it('accepte une mise à jour de cercle valide', async () => {
    const dto = plainToInstance(UpdateLayerDto, {
      settings: { type: 'circle', x: 1, y: 2, radius: 4, color: '#22c55e' },
    });
    expect(await settingsHasError(dto)).toBe(false);
  });

  it('accepte une mise à jour de filtre valide', async () => {
    const dto = plainToInstance(UpdateLayerDto, {
      settings: { filterKey: 'contrast', value: -20 },
    });
    expect(await settingsHasError(dto)).toBe(false);
  });

  it('rejette une mise à jour de settings malformée', async () => {
    const dto = plainToInstance(UpdateLayerDto, {
      settings: {
        type: 'circle',
        x: 'nope',
        y: 2,
        radius: 4,
        color: '#22c55e',
      },
    });
    expect(await settingsHasError(dto)).toBe(true);
  });
});
