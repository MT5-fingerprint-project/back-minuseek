import {
  ArgumentMetadata,
  BadRequestException,
  ValidationPipe,
} from '@nestjs/common';
import { GenerateReportDto } from './generate-report.dto';

const BODY: ArgumentMetadata = { type: 'body', metatype: GenerateReportDto };

const pipe = new ValidationPipe({
  whitelist: true,
  forbidNonWhitelisted: true,
});

const transform = (body: unknown): Promise<GenerateReportDto> =>
  pipe.transform(body, BODY) as Promise<GenerateReportDto>;

describe('GenerateReportDto', () => {
  it('accepte une génération sans préférence de journal', async () => {
    await expect(transform({ type: 'TECHNICAL' })).resolves.toEqual({
      type: 'TECHNICAL',
    });
  });

  it.each(['SUMMARY', 'FULL'])('accepte la variante %s', async (detail) => {
    await expect(
      transform({ type: 'TECHNICAL', journalDetail: detail }),
    ).resolves.toMatchObject({ journalDetail: detail });
  });

  it('refuse une variante de journal inconnue', async () => {
    await expect(
      transform({ type: 'TECHNICAL', journalDetail: 'COMPLET' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('refuse un type de rapport inconnu', async () => {
    await expect(transform({ type: 'JOURNAL' })).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('refuse un champ que le contrôle d’entrée ne connaît pas', async () => {
    await expect(
      transform({ type: 'TECHNICAL', signerUserId: 'user-1' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
