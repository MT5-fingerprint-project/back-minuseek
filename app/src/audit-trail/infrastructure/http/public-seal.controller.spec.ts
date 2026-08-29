import {
  ArgumentMetadata,
  BadRequestException,
  NotFoundException,
  ValidationPipe,
} from '@nestjs/common';
import type { QueryBus } from '@nestjs/cqrs';
import { FindSealHandler } from '../../application/queries/find-seal/find-seal.handler';
import { FindSealQuery } from '../../application/queries/find-seal/find-seal.query';
import type {
  PublicSealReader,
  PublicSealRecord,
} from '../../application/ports/public-seal.reader';
import { PublicSealParamsDto } from './dto/public-seal-params.dto';
import { PublicSealController } from './public-seal.controller';

const AT = new Date('2026-03-16T17:03:00.000Z');
const DIGEST = 'a'.repeat(64);

interface Row extends PublicSealRecord {
  tenantSlug: string;
  sha256: string;
}

function reader(rows: Row[], laboratories: Record<string, string>) {
  return {
    findLaboratoryName: (slug: string) =>
      Promise.resolve(laboratories[slug] ?? null),
    findSeal: (slug: string, sha256: string) =>
      Promise.resolve(
        rows.find((row) => row.tenantSlug === slug && row.sha256 === sha256) ??
          null,
      ),
    reportNeighbours: (
      slug: string,
      caseId: string,
      reportType: string,
      sealedAt: Date,
    ) => {
      const siblings = rows.filter(
        (row) =>
          row.tenantSlug === slug &&
          row.kind === 'REPORT' &&
          row.caseId === caseId &&
          row.reportType === reportType,
      );
      return Promise.resolve({
        hasEarlier: siblings.some(
          (one) => one.sealedAt.getTime() < sealedAt.getTime(),
        ),
        hasLater: siblings.some(
          (one) => one.sealedAt.getTime() > sealedAt.getTime(),
        ),
      });
    },
  } as PublicSealReader;
}

function build(
  rows: Row[] = [],
  laboratories: Record<string, string> = {
    demo: 'Laboratoire de démonstration',
  },
) {
  const handler = new FindSealHandler(reader(rows, laboratories));
  const queryBus = {
    execute: (query: FindSealQuery) => handler.execute(query),
  } as unknown as QueryBus;
  return new PublicSealController(queryBus);
}

function row(overrides: Partial<Row> = {}): Row {
  return {
    tenantSlug: 'demo',
    sha256: DIGEST,
    kind: 'TRACE',
    sealedAt: AT,
    anchoredAt: null,
    caseId: 'case-1',
    reportType: null,
    ...overrides,
  };
}

const PARAMS: ArgumentMetadata = {
  type: 'param',
  metatype: PublicSealParamsDto,
};

const pipe = new ValidationPipe({
  whitelist: true,
  forbidNonWhitelisted: true,
  transform: true,
});

const validate = (params: unknown): Promise<PublicSealParamsDto> =>
  pipe.transform(params, PARAMS) as Promise<PublicSealParamsDto>;

describe('PublicSealController — ce que la route dit', () => {
  it('reconnaît un fichier scellé et nomme le laboratoire', async () => {
    const controller = build([row()]);

    await expect(
      controller.find({ slug: 'demo', sha256: DIGEST }),
    ).resolves.toEqual({
      known: true,
      kind: 'TRACE',
      laboratory: 'Laboratoire de démonstration',
      sealedAt: AT,
      anchoredAt: null,
      precededByEarlierReport: false,
      supersededByNewerReport: false,
    });
  });

  it('ne laisse sortir aucun identifiant technique du dossier ou de la pièce', async () => {
    const controller = build([row()]);

    const body = await controller.find({ slug: 'demo', sha256: DIGEST });

    expect(Object.keys(body).sort()).toEqual([
      'anchoredAt',
      'kind',
      'known',
      'laboratory',
      'precededByEarlierReport',
      'sealedAt',
      'supersededByNewerReport',
    ]);
  });

  it('rend la date de l’horodatage extérieur quand elle existe', async () => {
    const anchoredAt = new Date('2026-03-17T02:00:00.000Z');
    const controller = build([row({ anchoredAt })]);

    await expect(
      controller.find({ slug: 'demo', sha256: DIGEST }),
    ).resolves.toMatchObject({ anchoredAt });
  });
});

describe('PublicSealController — ce que la route tait', () => {
  async function bodyOf(promise: Promise<unknown>): Promise<unknown> {
    return promise.then(
      () => null,
      (error: NotFoundException) => ({
        status: error.getStatus(),
        body: error.getResponse(),
      }),
    );
  }

  it('rend le même refus pour une empreinte inconnue et pour un laboratoire inconnu', async () => {
    const controller = build([row()]);

    const unknownDigest = await bodyOf(
      controller.find({ slug: 'demo', sha256: 'b'.repeat(64) }),
    );
    const unknownLaboratory = await bodyOf(
      controller.find({ slug: 'laboratoire-inexistant', sha256: DIGEST }),
    );

    expect(unknownDigest).toEqual({ status: 404, body: { known: false } });
    expect(unknownLaboratory).toEqual(unknownDigest);
  });

  it('ne reconnaît pas dans un laboratoire une empreinte scellée dans un autre', async () => {
    const controller = build([row({ tenantSlug: 'srpts-paris' })], {
      demo: 'Laboratoire de démonstration',
      'srpts-paris': 'S.R.P.T.S. de Paris',
    });

    await expect(
      controller.find({ slug: 'demo', sha256: DIGEST }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe('PublicSealController — la filiation d’un rapport', () => {
  const report = (overrides: Partial<Row> = {}) =>
    row({ kind: 'REPORT', reportType: 'TECHNICAL', ...overrides });

  it('signale l’existence d’une version antérieure et d’une version ultérieure', async () => {
    const controller = build([
      report({
        sha256: 'b'.repeat(64),
        sealedAt: new Date('2026-03-15T10:00:00.000Z'),
      }),
      report(),
      report({
        sha256: 'c'.repeat(64),
        sealedAt: new Date('2026-03-18T10:00:00.000Z'),
      }),
    ]);

    await expect(
      controller.find({ slug: 'demo', sha256: DIGEST }),
    ).resolves.toMatchObject({
      precededByEarlierReport: true,
      supersededByNewerReport: true,
    });
  });

  it('ne compte pas un journal détaillé comme une version du rapport', async () => {
    const controller = build([
      report(),
      report({
        sha256: 'c'.repeat(64),
        reportType: 'TRACEABILITY',
        sealedAt: new Date('2026-03-18T10:00:00.000Z'),
      }),
    ]);

    await expect(
      controller.find({ slug: 'demo', sha256: DIGEST }),
    ).resolves.toMatchObject({
      precededByEarlierReport: false,
      supersededByNewerReport: false,
    });
  });

  it('ne signale aucune filiation pour une trace', async () => {
    const controller = build([
      row(),
      report({
        sha256: 'c'.repeat(64),
        sealedAt: new Date('2026-03-18T10:00:00.000Z'),
      }),
    ]);

    await expect(
      controller.find({ slug: 'demo', sha256: DIGEST }),
    ).resolves.toMatchObject({
      precededByEarlierReport: false,
      supersededByNewerReport: false,
    });
  });

  it('garde les mêmes clés quand aucune version voisine n’existe', async () => {
    const controller = build([report()]);

    const body = await controller.find({ slug: 'demo', sha256: DIGEST });

    expect(body).toHaveProperty('precededByEarlierReport', false);
    expect(body).toHaveProperty('supersededByNewerReport', false);
  });
});

describe('PublicSealParamsDto', () => {
  it('résout une empreinte écrite en majuscules', async () => {
    await expect(
      validate({ slug: 'demo', sha256: 'A'.repeat(64) }),
    ).resolves.toMatchObject({ sha256: 'a'.repeat(64) });
  });

  it('refuse une empreinte de soixante-trois caractères', async () => {
    await expect(
      validate({ slug: 'demo', sha256: 'a'.repeat(63) }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('refuse une empreinte qui n’est pas hexadécimale', async () => {
    await expect(
      validate({ slug: 'demo', sha256: 'z'.repeat(64) }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it.each(['Demo', 'de_mo', 'demo/../admin', ''])(
    'refuse le laboratoire malformé %p, sans distinguer aucun laboratoire',
    async (slug) => {
      await expect(validate({ slug, sha256: DIGEST })).rejects.toBeInstanceOf(
        BadRequestException,
      );
    },
  );

  it('accepte un slug en minuscules, chiffres et tirets', async () => {
    await expect(
      validate({ slug: 'srpts-paris-75', sha256: DIGEST }),
    ).resolves.toMatchObject({ slug: 'srpts-paris-75' });
  });
});
