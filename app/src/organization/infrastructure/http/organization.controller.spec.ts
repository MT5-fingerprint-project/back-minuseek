import { BadRequestException, ConflictException } from '@nestjs/common';
import type { CreateOrganizationUserHandler } from '../../application/commands/create-organization-user/create-organization-user.handler';
import type { CreateOrganizationHandler } from '../../application/commands/create-organization/create-organization.handler';
import type { DeleteOrganizationHandler } from '../../application/commands/delete-organization/delete-organization.handler';
import type { DeleteOrganizationUserHandler } from '../../application/commands/delete-organization-user/delete-organization-user.handler';
import {
  InvalidOrganizationSlugError,
  OrganizationAlreadyExistsError,
} from '../../application/organization.errors';
import type { ListOrganizationsHandler } from '../../application/queries/list-organizations/list-organizations.handler';
import type { ListOrganizationUsersHandler } from '../../application/queries/list-organization-users/list-organization-users.handler';
import { OrganizationController } from './organization.controller';

function buildController(handler: CreateOrganizationHandler) {
  return new OrganizationController(
    handler,
    { execute: jest.fn() } as unknown as ListOrganizationsHandler,
    { execute: jest.fn() } as unknown as DeleteOrganizationHandler,
    { execute: jest.fn() } as unknown as ListOrganizationUsersHandler,
    { execute: jest.fn() } as unknown as CreateOrganizationUserHandler,
    { execute: jest.fn() } as unknown as DeleteOrganizationUserHandler,
  );
}

function controllerFailingWith(error: Error) {
  const handler = {
    execute: () => Promise.reject(error),
  } as unknown as CreateOrganizationHandler;
  return buildController(handler);
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
          id: 'id-labo-lyon',
          slug: 'labo-lyon',
          displayName: 'PTS Lyon',
          realm: 'minuseek-labo-lyon',
          databaseName: 'minuseek_labo_lyon',
          identityProviderRealm: 'minuseek-labo-lyon',
        }),
    } as unknown as CreateOrganizationHandler;
    const controller = buildController(handler);

    await expect(controller.create(DTO)).resolves.toEqual({
      id: 'id-labo-lyon',
      slug: 'labo-lyon',
      displayName: 'PTS Lyon',
      realm: 'minuseek-labo-lyon',
      databaseName: 'minuseek_labo_lyon',
      identityProviderRealm: 'minuseek-labo-lyon',
    });
  });
});
