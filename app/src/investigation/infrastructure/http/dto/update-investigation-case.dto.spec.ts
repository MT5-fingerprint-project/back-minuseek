import {
  ArgumentMetadata,
  BadRequestException,
  ValidationPipe,
} from '@nestjs/common';
import { UpdateInvestigationCaseDto } from './update-investigation-case.dto';

const PIERRE = 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d';

const BODY: ArgumentMetadata = {
  type: 'body',
  metatype: UpdateInvestigationCaseDto,
};

const pipe = new ValidationPipe({
  whitelist: true,
  forbidNonWhitelisted: true,
});

const transform = (body: unknown): Promise<UpdateInvestigationCaseDto> =>
  pipe.transform(body, BODY) as Promise<UpdateInvestigationCaseDto>;

const expectRejection = async (
  body: unknown,
  property: string,
): Promise<void> => {
  await expect(transform(body)).rejects.toBeInstanceOf(BadRequestException);
  const messages = await transform(body).then(
    () => [] as string[],
    (error: BadRequestException) =>
      (error.getResponse() as { message: string[] }).message,
  );
  expect(messages).toEqual(
    expect.arrayContaining([expect.stringContaining(property)]),
  );
};

describe('UpdateInvestigationCaseDto', () => {
  it('accepte un corps vide : on envoie ce qu’on corrige', async () => {
    await expect(transform({})).resolves.toEqual({});
  });

  it('accepte les trois champs ensemble', async () => {
    await expect(
      transform({
        pvNumber: 'PV-2026-118',
        description: 'Vol avec effraction',
        operatorUserId: PIERRE,
      }),
    ).resolves.toEqual({
      pvNumber: 'PV-2026-118',
      description: 'Vol avec effraction',
      operatorUserId: PIERRE,
    });
  });

  it('laisse passer une description à null, qui vide la colonne', async () => {
    await expect(transform({ description: null })).resolves.toEqual({
      description: null,
    });
  });

  it('refuse un numéro de procès-verbal à null, que la colonne ne prend pas', async () => {
    await expectRejection({ pvNumber: null }, 'pvNumber');
  });

  it.each([
    ['un numéro de procès-verbal vide', { pvNumber: '' }, 'pvNumber'],
    ['une description vide', { description: '' }, 'description'],
    [
      'un numéro de procès-verbal qui n’est pas du texte',
      { pvNumber: 42 },
      'pvNumber',
    ],
    [
      'un opérateur qui n’est pas un identifiant',
      { operatorUserId: 'pierre' },
      'operatorUserId',
    ],
    ['un opérateur à null', { operatorUserId: null }, 'operatorUserId'],
    ['un champ que la route ne connaît pas', { statut: 'CLOSED' }, 'statut'],
  ])('refuse %s', async (_refus, body, property) => {
    await expectRejection(body, property);
  });
});
