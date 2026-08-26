import { NotFoundException } from '@nestjs/common';
import { UserReadModel } from '../../application/queries/get-user-by-provider-id/user-read-model';
import { MeController } from './me.controller';

const MARIE: UserReadModel = {
  id: 'user-1',
  identityProviderId: 'kc-sub-1',
  role: 'OPERATOR',
  grade: 'Technicien',
  serviceNumber: 'PTS-0007',
  firstName: 'Marie',
  lastName: 'Curie',
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
};

describe('MeController', () => {
  const controller = new MeController();

  it('rend le profil de l’appelant sans exposer son identifiant de connexion', () => {
    expect(controller.me(MARIE)).toEqual({
      id: 'user-1',
      firstName: 'Marie',
      lastName: 'Curie',
      role: 'OPERATOR',
      grade: 'Technicien',
      serviceNumber: 'PTS-0007',
    });
  });

  it('répond 404 quand le jeton n’a pas de compte en base', () => {
    expect(() => controller.me(undefined)).toThrow(NotFoundException);
  });
});
