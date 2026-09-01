import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateLayerDto } from '../dto/create-layer.dto';
import { UpdateLayerDto } from '../dto/update-layer.dto';
import {
  ANNOTATION_FRAME,
  ANNOTATION_SCHEMA_VERSION,
} from '../dto/settings/annotation-settings.dto';
import { MinutiaTypeEnum } from '../../../../shared/domain/forensics/minutiae';

const FP = '11111111-1111-4111-8111-111111111111';

async function settingsHasError(dto: object): Promise<boolean> {
  const errors = await validate(dto, {
    whitelist: true,
    forbidNonWhitelisted: true,
  });
  return errors.some((e) => e.property === 'settings');
}

async function settingsErrorMessages(dto: object): Promise<string[]> {
  const errors = await validate(dto, {
    whitelist: true,
    forbidNonWhitelisted: true,
  });
  const settingsError = errors.find((e) => e.property === 'settings');
  return Object.values(settingsError?.constraints ?? {});
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

function omit<T extends object, K extends keyof T>(obj: T, key: K): Omit<T, K> {
  const rest = { ...obj };
  delete rest[key];
  return rest;
}

describe('IsLayerSettings (CreateLayerDto)', () => {
  const validCircle = {
    type: 'circle',
    x: 10,
    y: 20,
    radius: 4,
    color: '#ef4444',
    frame: ANNOTATION_FRAME,
    schemaVersion: ANNOTATION_SCHEMA_VERSION,
  };
  const validArrow = {
    type: 'circleArrow',
    x: 10,
    y: 20,
    radius: 4,
    color: '#3b82f6',
    arrowEndX: 30,
    arrowEndY: 40,
    frame: ANNOTATION_FRAME,
    schemaVersion: ANNOTATION_SCHEMA_VERSION,
  };
  const validPencil = {
    type: 'pencil',
    points: [0, 0, 5, 5, 10, 2],
    color: '#000000',
    strokeWidth: 2,
    frame: ANNOTATION_FRAME,
    schemaVersion: ANNOTATION_SCHEMA_VERSION,
  };
  const validMinutia = {
    type: 'minutia',
    x: 10,
    y: 20,
    radius: 4,
    color: '#22c55e',
    angle: 90,
    minutiaType: MinutiaTypeEnum.BIFURCATION,
    frame: ANNOTATION_FRAME,
    schemaVersion: ANNOTATION_SCHEMA_VERSION,
  };
  const validFilter = { filterKey: 'brightness', value: 50 };
  const validPair = {
    type: 'pair',
    referencePrintId: FP,
    traceMinutiaId: '22222222-2222-4222-8222-222222222222',
    referenceMinutiaId: '33333333-3333-4333-8333-333333333333',
    frame: ANNOTATION_FRAME,
    schemaVersion: ANNOTATION_SCHEMA_VERSION,
  };

  it.each<[string, unknown, string]>([
    ['circle', validCircle, 'ANNOTATION'],
    ['circleArrow', validArrow, 'ANNOTATION'],
    ['pencil', validPencil, 'ANNOTATION'],
    [
      'pencil avec une épaisseur de trait flottante',
      { ...validPencil, strokeWidth: 1.5 },
      'ANNOTATION',
    ],
    ['minutia', validMinutia, 'ANNOTATION'],
    [
      'circle portant un type de minutie',
      { ...validCircle, minutiaType: MinutiaTypeEnum.BIFURCATION },
      'ANNOTATION',
    ],
    ['pair', validPair, 'ANNOTATION'],
    [
      'minutia avec angle à la borne basse (0)',
      { ...validMinutia, angle: 0 },
      'ANNOTATION',
    ],
    [
      'minutia avec angle à la borne haute (359)',
      { ...validMinutia, angle: 359 },
      'ANNOTATION',
    ],
    ['filter', validFilter, 'FILTER'],
  ])('accepte un payload %s valide', async (_label, settings, type) => {
    expect(await settingsHasError(createDto(type, settings))).toBe(false);
  });

  it.each(Object.values(MinutiaTypeEnum))(
    'accepte chaque type de minutie du catalogue (%s)',
    async (minutiaType) => {
      expect(
        await settingsHasError(
          createDto('ANNOTATION', { ...validMinutia, minutiaType }),
        ),
      ).toBe(false);
    },
  );

  it.each(Object.values(MinutiaTypeEnum))(
    'accepte chaque type de minutie sur un point simple (%s)',
    async (minutiaType) => {
      expect(
        await settingsHasError(
          createDto('ANNOTATION', { ...validCircle, minutiaType }),
        ),
      ).toBe(false);
    },
  );

  it.each<[string, unknown]>([
    ['cercle sans x', { ...validCircle, x: undefined }],
    ['couleur non hexadécimale', { ...validCircle, color: 'rouge' }],
    ['type inconnu', { type: 'square', x: 1, y: 2, radius: 4, color: '#fff' }],
    ['champ en trop', { ...validCircle, evil: true }],
    ['crayon avec < 2 points', { ...validPencil, points: [0, 0] }],
    [
      'crayon avec un point non entier',
      { ...validPencil, points: [0, 0, 5, 5.5] },
    ],
    ['cercle avec un angle en trop', { ...validCircle, angle: 45 }],
    [
      'cercle avec un type de minutie inconnu',
      { ...validCircle, minutiaType: 'SCAR' },
    ],
    ['settings null', null],
    ['settings tableau', [1, 2, 3]],
    ['annotation sans repère (frame)', omit(validCircle, 'frame')],
    [
      'annotation avec un repère d’affichage',
      { ...validCircle, frame: 'display-pixels' },
    ],
    ['annotation sans version de schéma', omit(validCircle, 'schemaVersion')],
    ['minutie sans repère (frame)', omit(validMinutia, 'frame')],
    [
      'minutie avec un repère d’affichage',
      { ...validMinutia, frame: 'display-pixels' },
    ],
    ['minutie sans version de schéma', omit(validMinutia, 'schemaVersion')],
    [
      'minutie avec une abscisse non entière (200,5)',
      { ...validMinutia, x: 200.5 },
    ],
    ['minutie avec un angle à 360', { ...validMinutia, angle: 360 }],
    ['minutie avec un angle négatif', { ...validMinutia, angle: -1 }],
    ['minutie avec un type inconnu', { ...validMinutia, minutiaType: 'SCAR' }],
    ['minutie sans type de minutie', omit(validMinutia, 'minutiaType')],
    ['paire sans identifiant d’empreinte', omit(validPair, 'referencePrintId')],
    [
      'paire avec un identifiant d’empreinte non UUID',
      { ...validPair, referencePrintId: 'not-a-uuid' },
    ],
    ['paire sans minutie de trace', omit(validPair, 'traceMinutiaId')],
    ['paire sans minutie de référence', omit(validPair, 'referenceMinutiaId')],
    ['paire avec un champ en trop', { ...validPair, evil: true }],
    ['paire sans repère (frame)', omit(validPair, 'frame')],
    ['paire sans version de schéma', omit(validPair, 'schemaVersion')],
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

  it('le message d’erreur nomme le repère attendu en pixels de l’image source', async () => {
    const messages = await settingsErrorMessages(
      createDto('ANNOTATION', { ...validCircle, x: 200.5 }),
    );
    expect(messages.some((m) => m.includes(ANNOTATION_FRAME))).toBe(true);
    expect(messages.some((m) => m.toLowerCase().includes('integer'))).toBe(
      true,
    );
  });
});

describe('IsLayerSettings (UpdateLayerDto, type inféré du contenu)', () => {
  it('accepte une mise à jour de cercle valide', async () => {
    const dto = plainToInstance(UpdateLayerDto, {
      settings: {
        type: 'circle',
        x: 1,
        y: 2,
        radius: 4,
        color: '#22c55e',
        frame: ANNOTATION_FRAME,
        schemaVersion: ANNOTATION_SCHEMA_VERSION,
      },
    });
    expect(await settingsHasError(dto)).toBe(false);
  });

  it('accepte une mise à jour de cercle portant un type de minutie', async () => {
    const dto = plainToInstance(UpdateLayerDto, {
      settings: {
        type: 'circle',
        x: 1,
        y: 2,
        radius: 4,
        color: '#22c55e',
        minutiaType: MinutiaTypeEnum.ISLAND,
        frame: ANNOTATION_FRAME,
        schemaVersion: ANNOTATION_SCHEMA_VERSION,
      },
    });
    expect(await settingsHasError(dto)).toBe(false);
  });

  it('accepte une mise à jour de minutie valide sans type de calque explicite', async () => {
    const dto = plainToInstance(UpdateLayerDto, {
      settings: {
        type: 'minutia',
        x: 1,
        y: 2,
        radius: 4,
        color: '#22c55e',
        angle: 180,
        minutiaType: MinutiaTypeEnum.RIDGE_ENDING,
        frame: ANNOTATION_FRAME,
        schemaVersion: ANNOTATION_SCHEMA_VERSION,
      },
    });
    expect(await settingsHasError(dto)).toBe(false);
  });

  it('accepte une mise à jour de paire valide sans type de calque explicite', async () => {
    const dto = plainToInstance(UpdateLayerDto, {
      settings: {
        type: 'pair',
        referencePrintId: FP,
        traceMinutiaId: '22222222-2222-4222-8222-222222222222',
        referenceMinutiaId: '33333333-3333-4333-8333-333333333333',
        frame: ANNOTATION_FRAME,
        schemaVersion: ANNOTATION_SCHEMA_VERSION,
      },
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
        frame: ANNOTATION_FRAME,
        schemaVersion: ANNOTATION_SCHEMA_VERSION,
      },
    });
    expect(await settingsHasError(dto)).toBe(true);
  });
});
