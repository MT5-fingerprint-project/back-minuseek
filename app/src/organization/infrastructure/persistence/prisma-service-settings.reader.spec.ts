import type { PrismaClient } from '../../../../generated/prisma/client';
import type { TenantConnectionService } from '../../../tenancy/infrastructure/persistence/tenant-connection.service';
import { PrismaServiceSettingsReader } from './prisma-service-settings.reader';

const SRPTS = {
  administration:
    "MINISTÈRE DE L'INTÉRIEUR — DIRECTION GÉNÉRALE DE LA POLICE NATIONALE",
  serviceName: 'SERVICE RÉGIONAL DE POLICE TECHNIQUE ET SCIENTIFIQUE',
  postalAddress: '36 rue du Bastion — 75017 PARIS',
  phoneNumber: '01 40 79 60 00',
  email: 'srpts.paris@interieur.gouv.fr',
  signatureCity: 'Paris',
};

class FakePrismaClient {
  readonly findArgs: { where: { id: string } }[] = [];
  row: Record<string, unknown> | null = null;

  readonly serviceSettings = {
    findUnique: (args: {
      where: { id: string };
    }): Promise<Record<string, unknown> | null> => {
      this.findArgs.push(args);
      return Promise.resolve(this.row);
    },
  };
}

function build() {
  const prisma = new FakePrismaClient();
  const tenantConnection = {
    getCurrentClient: () => Promise.resolve(prisma as unknown as PrismaClient),
  } as unknown as TenantConnectionService;
  return { prisma, reader: new PrismaServiceSettingsReader(tenantConnection) };
}

describe('PrismaServiceSettingsReader', () => {
  it("rend les six champs de l'en-tête, sans les colonnes techniques", async () => {
    const { reader, prisma } = build();
    prisma.row = {
      id: 'service-settings',
      ...SRPTS,
      createdAt: new Date('2026-01-01T10:00:00Z'),
      updatedAt: new Date('2026-01-02T10:00:00Z'),
    };

    expect(await reader.find()).toEqual(SRPTS);
  });

  it('lit sous la clé fixe du réglage de service', async () => {
    const { reader, prisma } = build();

    await reader.find();

    expect(prisma.findArgs).toEqual([{ where: { id: 'service-settings' } }]);
  });

  it("rend null quand le service n'a rien saisi", async () => {
    const { reader } = build();

    expect(await reader.find()).toBeNull();
  });
});
