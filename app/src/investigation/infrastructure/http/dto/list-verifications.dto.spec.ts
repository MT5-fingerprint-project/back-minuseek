import {
  ArgumentMetadata,
  BadRequestException,
  ValidationPipe,
} from '@nestjs/common';
import { ListVerificationsDto } from './list-verifications.dto';

const QUERY: ArgumentMetadata = {
  type: 'query',
  metatype: ListVerificationsDto,
};

const pipe = new ValidationPipe({
  whitelist: true,
  forbidNonWhitelisted: true,
});

const transform = (query: unknown): Promise<ListVerificationsDto> =>
  pipe.transform(query, QUERY) as Promise<ListVerificationsDto>;

describe('ListVerificationsDto', () => {
  it('accepte la lecture de ses propres missions', async () => {
    await expect(transform({ mine: 'true' })).resolves.toEqual({
      mine: 'true',
    });
  });

  it.each([{}, { mine: 'false' }, { mine: '' }, { mine: 'TRUE' }])(
    "refuse %p, qui demanderait les missions de quelqu'un d'autre",
    async (query) => {
      await expect(transform(query)).rejects.toBeInstanceOf(
        BadRequestException,
      );
    },
  );

  it("refuse un filtre que la route n'expose pas", async () => {
    await expect(
      transform({ mine: 'true', verifierUserId: 'user-lucie' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
