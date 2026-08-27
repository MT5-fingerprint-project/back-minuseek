import type { INestApplication } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { Test } from '@nestjs/testing';
import type { NextFunction, Response } from 'express';
import type { Server } from 'node:http';
import request from 'supertest';
import { AuditTrailController } from '../../../audit-trail/infrastructure/http/audit-trail.controller';
import { BiometricsController } from '../../../biometrics/infrastructure/http/biometrics.controller';
import { LayersController } from '../../../biometrics/infrastructure/http/layers.controller';
import type { UserReadModel } from '../../../identity-access/application/queries/get-user-by-provider-id/user-read-model';
import { UserRoleEnum } from '../../../identity-access/domain/user/value-objects/user-role.vo';
import { MeController } from '../../../identity-access/infrastructure/http/me.controller';
import { SubjectController } from '../../../identity-access/infrastructure/http/subject.controller';
import { UserController } from '../../../identity-access/infrastructure/http/user.controller';
import { InvestigationController } from '../../../investigation/infrastructure/http/investigation.controller';
import { ListInvestigationCasesQuery } from '../../../investigation/application/queries/list-investigation-cases/list-investigation-cases.query';
import { ReportsController } from '../../../reporting/infrastructure/http/reports.controller';
import { ServiceSettingsController } from '../../../organization/infrastructure/http/service-settings.controller';
import { TenantContextService } from '../../../tenancy/application/tenant-context.service';
import { CASE_ACCESS_READER } from '../../application/case-access.reader';
import { CaseAccessService } from '../../application/case-access.service';
import { InMemoryCaseAccessReader } from '../persistence/in-memory-case-access.reader';
import type { RequestWithCaseAccess } from './case-access.guard';
import { CASE_NOT_FOUND_MESSAGE, CaseAccessGuard } from './case-access.guard';

const AFFAIRE = '11111111-1111-4111-8111-111111111111';
const TRACE = '22222222-2222-4222-8222-222222222222';
const EMPREINTE = '33333333-3333-4333-8333-333333333333';
const CALQUE = '44444444-4444-4444-8444-444444444444';
const PERSONNE = '55555555-5555-4555-8555-555555555555';
const RAPPORT = '66666666-6666-4666-8666-666666666666';

const MARIE: UserReadModel = {
  id: 'marie',
  identityProviderId: 'sub-marie',
  role: UserRoleEnum.OPERATOR,
  grade: 'Brigadier',
  serviceNumber: '12345',
  status: 'ACTIVE',
  firstName: 'Marie',
  lastName: 'Durand',
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-01T00:00:00.000Z'),
};
const LUCIE: UserReadModel = {
  ...MARIE,
  id: 'lucie',
  identityProviderId: 'sub-lucie',
  firstName: 'Lucie',
};

type Method = 'get' | 'post' | 'put' | 'patch' | 'delete';

interface Route {
  label: string;
  method: Method;
  url: string;
  body?: Record<string, unknown>;
  /** Les routes qui relisent l'affaire après l'avoir changée en envoient deux. */
  dispatches?: number;
}

const ROUTES_GARDEES: Route[] = [
  {
    label: 'GET /investigation-cases/:id',
    method: 'get',
    url: `/investigation-cases/${AFFAIRE}`,
  },
  {
    label: 'PATCH /investigation-cases/:id',
    method: 'patch',
    url: `/investigation-cases/${AFFAIRE}`,
    body: { pvNumber: 'PV-2026-118', operatorUserId: PERSONNE },
  },
  {
    label: 'POST /investigation-cases/:id/closure',
    method: 'post',
    url: `/investigation-cases/${AFFAIRE}/closure`,
    dispatches: 2,
  },
  {
    label: 'POST /investigation-cases/:id/reopening',
    method: 'post',
    url: `/investigation-cases/${AFFAIRE}/reopening`,
    body: { reason: 'Réquisition complémentaire' },
    dispatches: 2,
  },
  {
    label: 'GET /investigation-cases/:caseId/audit-events',
    method: 'get',
    url: `/investigation-cases/${AFFAIRE}/audit-events`,
  },
  {
    label: 'POST /investigation-cases/:caseId/reports',
    method: 'post',
    url: `/investigation-cases/${AFFAIRE}/reports`,
    body: { type: 'IDENTIFICATION' },
  },
  {
    label: 'GET /investigation-cases/:caseId/reports',
    method: 'get',
    url: `/investigation-cases/${AFFAIRE}/reports`,
  },
  {
    label: 'GET /reports/:id/download',
    method: 'get',
    url: `/reports/${RAPPORT}/download`,
  },
  { label: 'GET /traces', method: 'get', url: `/traces?caseId=${AFFAIRE}` },
  {
    label: 'GET /reference-prints',
    method: 'get',
    url: `/reference-prints?caseId=${AFFAIRE}`,
  },
  {
    label: 'POST /traces/:id/withdraw',
    method: 'post',
    url: `/traces/${TRACE}/withdraw`,
    body: { motive: 'DUPLICATE' },
  },
  {
    label: 'POST /reference-prints/:id/withdraw',
    method: 'post',
    url: `/reference-prints/${EMPREINTE}/withdraw`,
    body: { motive: 'DUPLICATE' },
  },
  {
    label: 'POST /traces/:id/restore',
    method: 'post',
    url: `/traces/${TRACE}/restore`,
  },
  {
    label: 'POST /reference-prints/:id/restore',
    method: 'post',
    url: `/reference-prints/${EMPREINTE}/restore`,
  },
  {
    label: 'POST /traces/:id/compare',
    method: 'post',
    url: `/traces/${TRACE}/compare`,
    body: { caseId: AFFAIRE, referencePrintIds: [EMPREINTE] },
  },
  {
    label: 'POST /traces/:id/hit',
    method: 'post',
    url: `/traces/${TRACE}/hit`,
    body: { caseId: AFFAIRE, referencePrintId: EMPREINTE },
  },
  {
    label: 'DELETE /traces/:id/hit/:referencePrintId',
    method: 'delete',
    url: `/traces/${TRACE}/hit/${EMPREINTE}?caseId=${AFFAIRE}`,
  },
  {
    label: 'GET /traces/:id/hits',
    method: 'get',
    url: `/traces/${TRACE}/hits`,
  },
  {
    label: 'GET /layers/:fingerprintId',
    method: 'get',
    url: `/layers/${TRACE}`,
  },
  {
    label: 'POST /layers',
    method: 'post',
    url: '/layers',
    body: {
      fingerprintId: TRACE,
      name: 'Calque',
      type: 'MINUTIAE',
      zIndex: 0,
      settings: {},
    },
  },
  {
    label: 'PUT /layers/:id',
    method: 'put',
    url: `/layers/${CALQUE}`,
    body: { name: 'Calque' },
  },
  { label: 'DELETE /layers/:id', method: 'delete', url: `/layers/${CALQUE}` },
  {
    label: 'POST /subjects',
    method: 'post',
    url: '/subjects',
    body: {
      caseId: AFFAIRE,
      firstName: 'Jean',
      lastName: 'Martin',
      birthDate: '1980-01-01',
      birthPlace: 'Paris',
      sex: 'M',
      type: 'SUSPECT',
    },
  },
  { label: 'GET /subjects', method: 'get', url: `/subjects?caseId=${AFFAIRE}` },
  { label: 'GET /subjects/:id', method: 'get', url: `/subjects/${PERSONNE}` },
];

class RecordingBus {
  readonly dispatched: unknown[] = [];

  execute(message: unknown): Promise<unknown> {
    this.dispatched.push(message);
    return Promise.resolve({});
  }
}

async function bootFor(caller: UserReadModel | undefined): Promise<{
  app: INestApplication;
  server: Server;
  bus: RecordingBus;
}> {
  const bus = new RecordingBus();
  const moduleRef = await Test.createTestingModule({
    controllers: [
      InvestigationController,
      AuditTrailController,
      ReportsController,
      BiometricsController,
      LayersController,
      SubjectController,
      UserController,
      MeController,
      ServiceSettingsController,
    ],
    providers: [
      CaseAccessService,
      TenantContextService,
      { provide: CommandBus, useValue: bus },
      { provide: QueryBus, useValue: bus },
      {
        provide: CASE_ACCESS_READER,
        useValue: new InMemoryCaseAccessReader({
          operators: [{ caseId: AFFAIRE, userId: MARIE.id }],
          traces: [{ id: TRACE, caseId: AFFAIRE }],
          referencePrints: [{ id: EMPREINTE, caseId: AFFAIRE }],
          layers: [{ id: CALQUE, fingerprintId: TRACE }],
          subjects: [{ id: PERSONNE, caseId: AFFAIRE }],
          reports: [{ id: RAPPORT, caseId: AFFAIRE }],
        }),
      },
      { provide: APP_GUARD, useClass: CaseAccessGuard },
    ],
  }).compile();

  const app = moduleRef.createNestApplication();
  // Ce que posent, en production, TenantGuard puis CurrentUserGuard : la suite
  // ne teste que ce qui vient après eux.
  app.use((req: RequestWithCaseAccess, _res: Response, next: NextFunction) => {
    req.tenantContext = { slug: 'tenant-demo' };
    req.user = {
      sub: caller?.identityProviderId ?? 'sub-inconnu',
      preferred_username: caller?.firstName.toLowerCase() ?? 'inconnu',
      name: caller ? `${caller.firstName} ${caller.lastName}` : 'Inconnu',
    };
    req.currentUser = caller;
    next();
  });
  await app.init();

  return { app, server: app.getHttpServer() as Server, bus };
}

function call(server: Server, route: Route): request.Test {
  const pending = request(server)[route.method](route.url);
  return route.body ? pending.send(route.body) : pending;
}

describe("Le garde d'accès, route par route — un opérateur étranger à l'affaire", () => {
  let app: INestApplication;
  let server: Server;
  let bus: RecordingBus;

  beforeEach(async () => {
    ({ app, server, bus } = await bootFor(LUCIE));
  });

  afterEach(async () => {
    await app.close();
  });

  it.each(ROUTES_GARDEES)(
    'reçoit « introuvable » sur $label',
    async (route) => {
      const response = await call(server, route);

      expect(response.status).toBe(404);
      expect((response.body as { message?: string }).message).toBe(
        CASE_NOT_FOUND_MESSAGE,
      );
      expect(bus.dispatched).toEqual([]);
    },
  );
});

describe("Le garde d'accès, route par route — l'opérateur de l'affaire", () => {
  let app: INestApplication;
  let server: Server;
  let bus: RecordingBus;

  beforeEach(async () => {
    ({ app, server, bus } = await bootFor(MARIE));
  });

  afterEach(async () => {
    await app.close();
  });

  it.each(ROUTES_GARDEES)(
    'passe sur $label et atteint son handler',
    async (route) => {
      const response = await call(server, route);

      expect(response.status).not.toBe(404);
      expect(bus.dispatched).toHaveLength(route.dispatches ?? 1);
    },
  );
});

describe("Le garde d'accès — les routes qui ne touchent aucune affaire", () => {
  let app: INestApplication;
  let server: Server;
  let bus: RecordingBus;

  beforeEach(async () => {
    ({ app, server, bus } = await bootFor(LUCIE));
  });

  afterEach(async () => {
    await app.close();
  });

  it("laisse ouvrir une affaire, qui n'existe pas encore au moment du contrôle", async () => {
    const response = await request(server)
      .post('/investigation-cases')
      .send({ caseNumber: 'AFF-001', pvNumber: 'PV-001' });

    expect(response.status).toBe(201);
  });

  it('laisse lire un profil par son identifiant de fournisseur', async () => {
    const response = await request(server).get(
      '/users/by-provider-id/sub-lucie',
    );

    expect(response.status).toBe(200);
  });

  it('laisse lister les comptes du service', async () => {
    const response = await request(server).get('/users');

    expect(response.status).toBe(200);
  });

  it('laisse lire les grades du service', async () => {
    const response = await request(server).get('/users/grades');

    expect(response.status).toBe(200);
  });

  it('laisse lire son propre profil', async () => {
    const response = await request(server).get('/me');

    expect(response.status).toBe(200);
  });

  // Ces deux-là documentent le périmètre, elles ne le protègent pas : le garde
  // laisse passer une route non marquée (case-access.guard.ts, mode !== GUARDED),
  // donc retirer le @NoCaseScope les laisserait vertes. Le filet réel serait un
  // test d'exhaustivité des routes, hors périmètre de ce ticket.
  it("laisse le responsable changer l'état d'un compte du service", async () => {
    const response = await request(server)
      .patch(`/users/${PERSONNE}/status`)
      .send({ status: 'DISABLED' });

    expect(response.status).toBe(204);
    expect(bus.dispatched).toHaveLength(1);
  });

  it('laisse le responsable corriger un profil du service', async () => {
    const response = await request(server)
      .patch(`/users/${PERSONNE}/profile`)
      .send({
        firstName: 'Julien',
        lastName: 'Marchand',
        grade: 'Brigadier-chef',
        serviceNumber: 'PTS-0042',
      });

    expect(response.status).toBe(204);
    expect(bus.dispatched).toHaveLength(1);
  });

  it("n'expose plus la création de compte au périmètre tenant", async () => {
    const response = await request(server)
      .post('/users')
      .send({ identityProviderId: 'sub-x', role: 'OPERATOR' });

    expect(response.status).toBe(404);
    expect((response.body as { message?: string }).message).toBe(
      'Cannot POST /users',
    );
    expect(bus.dispatched).toEqual([]);
  });

  it("laisse tout compte du service lire l'en-tête de son service", async () => {
    const response = await request(server).get('/service-settings');

    expect(response.status).toBe(200);
    expect(bus.dispatched).toHaveLength(1);
  });

  it("laisse l'enregistrement de l'en-tête franchir le garde : le rôle se juge dans le handler", async () => {
    const response = await request(server).put('/service-settings').send({
      administration: "MINISTÈRE DE L'INTÉRIEUR",
      serviceName: 'SRPTS',
      postalAddress: '36 rue du Bastion — 75017 PARIS',
      phoneNumber: '01 40 79 60 00',
      email: 'srpts.paris@interieur.gouv.fr',
      signatureCity: 'Paris',
    });

    expect(response.status).toBe(204);
    expect(bus.dispatched).toHaveLength(1);
  });

  it.each([
    { label: 'POST /traces', url: '/traces' },
    { label: 'POST /reference-prints', url: '/reference-prints' },
  ])(
    "laisse $label franchir le garde : c'est son handler qui contrôle",
    async ({ url }) => {
      const response = await request(server).post(url).field('caseId', AFFAIRE);

      expect(response.status).not.toBe(404);
    },
  );
});

describe("Le garde d'accès — la liste des affaires", () => {
  it("passe l'appelant à la query, à charge pour elle de filtrer", async () => {
    const { app, server, bus } = await bootFor(LUCIE);

    const response = await request(server).get('/investigation-cases');

    expect(response.status).toBe(200);
    expect(bus.dispatched).toEqual([
      new ListInvestigationCasesQuery(undefined, undefined, undefined, {
        id: LUCIE.id,
        role: UserRoleEnum.OPERATOR,
      }),
    ]);
    await app.close();
  });

  it('ne montre rien à un jeton sans compte dans le service', async () => {
    const { app, server, bus } = await bootFor(undefined);

    const response = await request(server).get('/investigation-cases');

    expect(response.status).toBe(200);
    expect(bus.dispatched).toEqual([
      new ListInvestigationCasesQuery(undefined, undefined, undefined, null),
    ]);
    await app.close();
  });
});
