import { BadRequestException, ConflictException } from '@nestjs/common';
import type { CreateOrganizationHandler } from '../../application/commands/create-organization/create-organization.handler';
import {
  InvalidOrganizationSlugError,
  OrganizationAlreadyExistsError,
} from '../../application/organization.errors';
import { OrganizationController } from './organization.controller';

function controllerFailingWith(error: Error) {
  const handler = {
    execute: () => Promise.reject(error),
  } as unknown as CreateOrganizationHandler;
  return new OrganizationController(handler);
}

const DTO = { slug: 'labo-lyon', displayName: 'PTS Lyon' };

describe('OrganizationController — traduction des erreurs aux frontières', () => {
  it('slug invalide → 400', async () => {
    const controller = controllerFailingWith(
      new InvalidOrganizationSlugError('labo-lyon'),
    );
    await expect(controller.create(DTO)).rejects.toThrow(BadRequestException);
  });

  it('organisation existante → 409', async () => {
    const controller = controllerFailingWith(
      new OrganizationAlreadyExistsError('labo-lyon'),
    );
    await expect(controller.create(DTO)).rejects.toThrow(ConflictException);
  });

  it('erreur inattendue → relancée telle quelle (500)', async () => {
    const controller = controllerFailingWith(new Error('keycloak down'));
    await expect(controller.create(DTO)).rejects.toThrow('keycloak down');
  });

  it('chemin nominal → renvoie le résultat du handler', async () => {
    const handler = {
      execute: () =>
        Promise.resolve({
          slug: 'labo-lyon',
          realm: 'minuseek-labo-lyon',
          databaseName: 'minuseek_labo_lyon',
        }),
    } as unknown as CreateOrganizationHandler;
    const controller = new OrganizationController(handler);

    await expect(controller.create(DTO)).resolves.toEqual({
      slug: 'labo-lyon',
      realm: 'minuseek-labo-lyon',
      databaseName: 'minuseek_labo_lyon',
    });
  });
});
