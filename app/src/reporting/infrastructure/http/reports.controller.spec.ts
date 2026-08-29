import {
  ArgumentMetadata,
  BadRequestException,
  NotFoundException,
  ValidationPipe,
} from '@nestjs/common';
import type { CommandBus, QueryBus } from '@nestjs/cqrs';
import type { AuthenticatedUser } from '../../../auth/infrastructure/http/auth.types';
import type { UserReadModel } from '../../../identity-access/application/queries/get-user-by-provider-id/user-read-model';
import { GenerateReportCommand } from '../../application/commands/generate-report/generate-report.command';
import { CaseNotFoundForReportError } from '../../domain/report/errors/case-not-found-for-report.error';
import { GenerateReportDto } from './dto/generate-report.dto';
import { ReportsController } from './reports.controller';

const JETON: AuthenticatedUser = {
  sub: 'kc-sub-42',
  preferred_username: 'saguilar',
  name: 'Sébastien Aguilar',
};

const AGUILAR: UserReadModel = {
  id: 'user-aguilar',
  identityProviderId: 'kc-sub-42',
  role: 'OPERATOR',
  grade: 'Technicien en Chef de Police Technique et Scientifique',
  serviceNumber: '118 402',
  status: 'ACTIVE',
  firstName: 'Sébastien',
  lastName: 'Aguilar',
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
};

function build(failWith?: Error) {
  const dispatched: GenerateReportCommand[] = [];
  const commandBus = {
    execute: (command: GenerateReportCommand) => {
      dispatched.push(command);
      return failWith
        ? Promise.reject(failWith)
        : Promise.resolve({ id: 'report-1', sha256: 'a'.repeat(64) });
    },
  } as unknown as CommandBus;
  const queryBus = {
    execute: () => Promise.resolve([]),
  } as unknown as QueryBus;

  return {
    controller: new ReportsController(commandBus, queryBus),
    dispatched,
  };
}

describe('ReportsController — on ne signe que pour soi', () => {
  it('signe du compte de service de l’appelant, grade et matricule compris', async () => {
    const { controller, dispatched } = build();

    await controller.generate('case-1', { type: 'TECHNICAL' }, JETON, AGUILAR);

    expect(dispatched[0].signer).toEqual({
      id: 'user-aguilar',
      grade: 'Technicien en Chef de Police Technique et Scientifique',
      firstName: 'Sébastien',
      lastName: 'Aguilar',
      serviceNumber: '118 402',
    });
  });

  it('refuse d’éditer un rapport pour un jeton sans compte dans le service', async () => {
    const { controller, dispatched } = build();

    await expect(
      controller.generate('case-1', { type: 'TECHNICAL' }, JETON, undefined),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(dispatched).toEqual([]);
  });
});

describe('ReportsController — génération', () => {
  it('résout une demande sans préférence en annexe résumée', async () => {
    const { controller, dispatched } = build();

    await controller.generate('case-1', { type: 'TECHNICAL' }, JETON, AGUILAR);

    expect(dispatched[0].journalDetail).toBe('SUMMARY');
  });

  it('transmet le journal détaillé quand il est demandé', async () => {
    const { controller, dispatched } = build();

    await controller.generate(
      'case-1',
      { type: 'TECHNICAL', journalDetail: 'FULL' },
      JETON,
      AGUILAR,
    );

    expect(dispatched[0].journalDetail).toBe('FULL');
  });

  it('transmet le dossier et le type demandés', async () => {
    const { controller, dispatched } = build();

    await controller.generate(
      'case-1',
      { type: 'TRACEABILITY' },
      JETON,
      AGUILAR,
    );

    expect(dispatched[0]).toMatchObject({
      caseId: 'case-1',
      type: 'TRACEABILITY',
    });
  });

  it('traduit un dossier inconnu en 404', async () => {
    const { controller } = build(new CaseNotFoundForReportError('case-1'));

    await expect(
      controller.generate('case-1', { type: 'TECHNICAL' }, JETON, AGUILAR),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('laisse remonter une panne technique au lieu de la traduire en 404', async () => {
    const { controller } = build(new Error('stockage injoignable'));

    await expect(
      controller.generate('case-1', { type: 'TECHNICAL' }, JETON, AGUILAR),
    ).rejects.toThrow('stockage injoignable');
  });
});

describe('GenerateReportDto — aucune identité ne s’envoie', () => {
  const pipe = new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
  });
  const metadata: ArgumentMetadata = {
    type: 'body',
    metatype: GenerateReportDto,
  };
  const transform = (body: unknown): Promise<GenerateReportDto> =>
    pipe.transform(body, metadata) as Promise<GenerateReportDto>;

  it('accepte une demande qui ne porte que le type', async () => {
    await expect(transform({ type: 'TECHNICAL' })).resolves.toEqual({
      type: 'TECHNICAL',
    });
  });

  it('refuse un signataire envoyé dans le corps : on ne signe pas pour autrui', async () => {
    await expect(
      transform({ type: 'TECHNICAL', signerUserId: 'user-michel' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('refuse un type de rapport inconnu', async () => {
    await expect(transform({ type: 'JOURNAL' })).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });
});
