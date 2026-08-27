import { ForbiddenException, NotFoundException } from '@nestjs/common';
import type { CommandBus, QueryBus } from '@nestjs/cqrs';
import type { AuthenticatedUser } from '../../../auth/infrastructure/http/auth.types';
import type { UserReadModel } from '../../../identity-access/application/queries/get-user-by-provider-id/user-read-model';
import { UserRoleEnum } from '../../../identity-access/domain/user/value-objects/user-role.vo';
import { SaveServiceSettingsCommand } from '../../application/commands/save-service-settings/save-service-settings.command';
import { GetServiceSettingsQuery } from '../../application/queries/get-service-settings/get-service-settings.query';
import { ServiceSettingsAdministrationNotAllowedError } from '../../domain/service-settings/errors/service-settings-administration-not-allowed.error';
import { ServiceSettingsController } from './service-settings.controller';

const JETON: AuthenticatedUser = {
  sub: 'kc-sub-42',
  preferred_username: 'nbelkacem',
  name: 'Nadia Belkacem',
};

const CHEF: UserReadModel = {
  id: 'user-chef',
  identityProviderId: 'kc-sub-42',
  role: UserRoleEnum.ADMIN,
  grade: 'Commandant',
  serviceNumber: 'PTS-0001',
  status: 'ACTIVE',
  firstName: 'Nadia',
  lastName: 'Belkacem',
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
};

const SRPTS = {
  administration:
    "MINISTÈRE DE L'INTÉRIEUR — DIRECTION GÉNÉRALE DE LA POLICE NATIONALE",
  serviceName: 'SERVICE RÉGIONAL DE POLICE TECHNIQUE ET SCIENTIFIQUE',
  postalAddress: '36 rue du Bastion — 75017 PARIS',
  phoneNumber: '01 40 79 60 00',
  email: 'srpts.paris@interieur.gouv.fr',
  signatureCity: 'Paris',
};

function build(failWith?: Error) {
  const dispatched: unknown[] = [];
  const commandBus = {
    execute: (command: unknown) => {
      dispatched.push(command);
      return failWith ? Promise.reject(failWith) : Promise.resolve(undefined);
    },
  } as unknown as CommandBus;
  const queried: unknown[] = [];
  const queryBus = {
    execute: (query: unknown) => {
      queried.push(query);
      return Promise.resolve(SRPTS);
    },
  } as unknown as QueryBus;

  return {
    controller: new ServiceSettingsController(commandBus, queryBus),
    dispatched,
    queried,
  };
}

describe("ServiceSettingsController — lecture de l'en-tête", () => {
  it("rend l'en-tête du service à un compte du service", async () => {
    const { controller, queried } = build();

    expect(await controller.get(CHEF)).toEqual(SRPTS);
    expect(queried).toEqual([new GetServiceSettingsQuery()]);
  });

  it("rend l'en-tête à un opérateur, qui en a besoin pour l'aperçu du rapport", async () => {
    const { controller } = build();

    expect(
      await controller.get({ ...CHEF, role: UserRoleEnum.OPERATOR }),
    ).toEqual(SRPTS);
  });

  it('refuse un jeton sans compte dans le service, sans interroger la lecture', async () => {
    const { controller, queried } = build();

    await expect(controller.get(undefined)).rejects.toThrow(NotFoundException);
    expect(queried).toEqual([]);
  });
});

describe("ServiceSettingsController — enregistrement de l'en-tête", () => {
  it("transmet l'auteur, le demandeur et les six champs à la commande", async () => {
    const { controller, dispatched } = build();

    await controller.save(SRPTS, JETON, CHEF);

    expect(dispatched).toEqual([
      new SaveServiceSettingsCommand(
        expect.anything() as never,
        { id: CHEF.id, role: UserRoleEnum.ADMIN },
        SRPTS,
      ),
    ]);
  });

  it.each([UserRoleEnum.OPERATOR, UserRoleEnum.EXPERT])(
    'transmet le rôle %s tel quel : le refus se décide dans le handler',
    async (role) => {
      const { controller, dispatched } = build();

      await controller.save(SRPTS, JETON, { ...CHEF, role });

      expect(dispatched).toEqual([
        new SaveServiceSettingsCommand(
          expect.anything() as never,
          { id: CHEF.id, role },
          SRPTS,
        ),
      ]);
    },
  );

  it("refuse l'écriture à un compte qui n'est pas responsable", async () => {
    const { controller } = build(
      new ServiceSettingsAdministrationNotAllowedError(),
    );

    await expect(
      controller.save(SRPTS, JETON, { ...CHEF, role: UserRoleEnum.OPERATOR }),
    ).rejects.toThrow(ForbiddenException);
  });

  it('refuse un jeton sans compte dans le service, sans rien envoyer', async () => {
    const { controller, dispatched } = build();

    await expect(controller.save(SRPTS, JETON, undefined)).rejects.toThrow(
      NotFoundException,
    );
    expect(dispatched).toEqual([]);
  });

  it("laisse remonter une panne qui n'est pas un refus d'autorisation", async () => {
    const panne = new Error('base indisponible');
    const { controller } = build(panne);

    await expect(controller.save(SRPTS, JETON, CHEF)).rejects.toBe(panne);
  });
});
