import {
  ArgumentMetadata,
  BadRequestException,
  ValidationPipe,
} from '@nestjs/common';
import { MAX_WITHDRAWAL_MOTIVE_DETAIL_LENGTH } from '../../../domain/withdrawal/withdrawal.vo';
import { WithdrawPieceDto } from './withdraw-piece.dto';

const BODY: ArgumentMetadata = { type: 'body', metatype: WithdrawPieceDto };

// Le pipe exact posé globalement dans main.ts.
const pipe = new ValidationPipe({
  whitelist: true,
  forbidNonWhitelisted: true,
});

const transform = (body: Record<string, string>): Promise<WithdrawPieceDto> =>
  pipe.transform(body, BODY) as Promise<WithdrawPieceDto>;

describe('WithdrawPieceDto', () => {
  it('accepte un motif de la liste sans précision', async () => {
    const dto = await transform({ motive: 'MISFILED' });

    expect(dto.motive).toBe('MISFILED');
    expect(dto.motiveDetail).toBeUndefined();
  });

  it('accepte OTHER accompagné de sa précision', async () => {
    const dto = await transform({
      motive: 'OTHER',
      motiveDetail: 'relevée sur un scellé rattaché à une autre procédure',
    });

    expect(dto.motiveDetail).toBe(
      'relevée sur un scellé rattaché à une autre procédure',
    );
  });

  it('refuse OTHER sans précision', async () => {
    await expect(transform({ motive: 'OTHER' })).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('refuse une précision plus longue que la colonne', async () => {
    await expect(
      transform({
        motive: 'OTHER',
        motiveDetail: 'a'.repeat(MAX_WITHDRAWAL_MOTIVE_DETAIL_LENGTH + 1),
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('refuse un motif hors liste', async () => {
    await expect(
      transform({ motive: 'BECAUSE_I_SAID_SO' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
