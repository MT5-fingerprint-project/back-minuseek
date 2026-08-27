import {
  BadRequestException,
  Controller,
  Get,
  NotFoundException,
  Post,
} from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { UserReadModel } from '../../../identity-access/application/queries/get-user-by-provider-id/user-read-model';
import { UserRoleEnum } from '../../../identity-access/domain/user/value-objects/user-role.vo';
import { TenantContextService } from '../../../tenancy/application/tenant-context.service';
import type {
  CaseAccessReader,
  CaseTitle,
} from '../../application/case-access.reader';
import { CaseAccessService } from '../../application/case-access.service';
import { InMemoryCaseAccessReader } from '../persistence/in-memory-case-access.reader';
import {
  CASE_NOT_FOUND_MESSAGE,
  MALFORMED_CASE_SCOPE_MESSAGE,
  CaseAccessGuard,
} from './case-access.guard';
import type { RequestWithCaseAccess } from './case-access.guard';
import {
  CaseScopeCheckedInHandler,
  CaseScoped,
  CaseScopedList,
  NoCaseScope,
} from './case-scope.decorator';
import { UnresolvableCaseScopeError } from './unresolvable-case-scope.error';

@Controller('layers')
class LayersRoutes {
  @Get(':fingerprintId')
  @CaseScoped()
  listLayers() {
    return null;
  }

  @Post()
  @CaseScoped()
  createLayer() {
    return null;
  }
}

@Controller('investigation-cases')
class CaseRoutes {
  @Get()
  @CaseScopedList()
  listCases() {
    return null;
  }

  @Post()
  @NoCaseScope("création : l'affaire n'existe pas encore")
  openCase() {
    return null;
  }

  @Get(':id')
  readCase() {
    return null;
  }
}

@Controller('subjects')
class SubjectRoutes {
  @Get()
  @CaseScoped()
  listSubjects() {
    return null;
  }

  @Post()
  @CaseScoped()
  registerSubject() {
    return null;
  }
}

@Controller()
class UploadRoutes {
  @Post('traces')
  @CaseScopeCheckedInHandler('corps multipart non lisible par un garde')
  uploadTrace() {
    return null;
  }
}

@Controller('me')
class ProfileRoutes {
  @Get()
  @CaseScoped()
  readProfile() {
    return null;
  }
}

const AFFAIRE = '11111111-1111-4111-8111-111111111111';
const AFFAIRE_ETRANGERE = '22222222-2222-4222-8222-222222222222';
const IMAGE = '44444444-4444-4444-8444-444444444444';
const IMAGE_INCONNUE = '99999999-9999-4999-8999-999999999999';

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
const NADIA: UserReadModel = {
  ...MARIE,
  id: 'nadia',
  identityProviderId: 'sub-nadia',
  role: UserRoleEnum.ADMIN,
  firstName: 'Nadia',
};

class UnreachableCaseAccessReader implements CaseAccessReader {
  findTitle(): Promise<CaseTitle | null> {
    return Promise.reject(new Error('base injoignable'));
  }

  findCaseIdsOf(): Promise<string[]> {
    return Promise.reject(new Error('base injoignable'));
  }

  findCaseIdOfResource(): Promise<string | null> {
    return Promise.reject(new Error('base injoignable'));
  }
}

function guardWith(reader: CaseAccessReader): CaseAccessGuard {
  return new CaseAccessGuard(
    new Reflector(),
    new CaseAccessService(reader),
    new TenantContextService(),
  );
}

function buildGuard(): CaseAccessGuard {
  return guardWith(
    new InMemoryCaseAccessReader({
      operators: [{ caseId: AFFAIRE, userId: 'marie' }],
      traces: [{ id: IMAGE, caseId: AFFAIRE }],
    }),
  );
}

function requestFor(
  currentUser: UserReadModel | undefined,
  overrides: Partial<RequestWithCaseAccess> = {},
): RequestWithCaseAccess {
  return {
    currentUser,
    tenantContext: { slug: 'tenant-demo' },
    method: 'GET',
    params: { fingerprintId: IMAGE },
    query: {},
    body: {},
    ...overrides,
  } as RequestWithCaseAccess;
}

function contextFor(
  controller: new () => object,
  handlerName: string,
  request: RequestWithCaseAccess,
): ExecutionContext {
  const prototype = controller.prototype as Record<string, () => unknown>;
  return {
    switchToHttp: () => ({ getRequest: () => request }),
    getClass: () => controller,
    getHandler: () => prototype[handlerName],
  } as unknown as ExecutionContext;
}

async function refusalOn(
  guard: CaseAccessGuard,
  controller: new () => object,
  handlerName: string,
  request: RequestWithCaseAccess,
): Promise<unknown> {
  return guard
    .canActivate(contextFor(controller, handlerName, request))
    .then(() => undefined)
    .catch((thrown: unknown) => thrown);
}

describe('CaseAccessGuard — les routes que le garde laisse passer', () => {
  it('laisse passer une route sans marqueur, sans rien poser sur la requête', async () => {
    const request = requestFor(LUCIE, { params: { id: AFFAIRE } });
    await expect(
      buildGuard().canActivate(contextFor(CaseRoutes, 'readCase', request)),
    ).resolves.toBe(true);
    expect(request.caseAccess).toBeUndefined();
  });

  it('laisse passer une liste que le handler filtre lui-même', async () => {
    const request = requestFor(LUCIE, { params: {} });
    await expect(
      buildGuard().canActivate(contextFor(CaseRoutes, 'listCases', request)),
    ).resolves.toBe(true);
    expect(request.caseAccess).toBeUndefined();
  });

  it('laisse passer une route exemptée avec sa raison', async () => {
    const request = requestFor(LUCIE, { params: {} });
    await expect(
      buildGuard().canActivate(contextFor(CaseRoutes, 'openCase', request)),
    ).resolves.toBe(true);
  });

  it('laisse passer une route dont le contrôle se fait dans le handler', async () => {
    const request = requestFor(LUCIE, { params: {} });
    await expect(
      buildGuard().canActivate(
        contextFor(UploadRoutes, 'uploadTrace', request),
      ),
    ).resolves.toBe(true);
    expect(request.caseAccess).toBeUndefined();
  });
});

describe('CaseAccessGuard — une route marquée', () => {
  it("pose l'affaire résolue et le titre sur la requête", async () => {
    const request = requestFor(MARIE);
    await expect(
      buildGuard().canActivate(contextFor(LayersRoutes, 'listLayers', request)),
    ).resolves.toBe(true);
    expect(request.caseAccess).toEqual({
      caseId: AFFAIRE,
      title: 'CASE_OPERATOR',
    });
  });

  it('reconnaît le responsable de service au rôle porté par son compte', async () => {
    const request = requestFor(NADIA);
    await expect(
      buildGuard().canActivate(contextFor(LayersRoutes, 'listLayers', request)),
    ).resolves.toBe(true);
    expect(request.caseAccess).toEqual({
      caseId: AFFAIRE,
      title: 'SERVICE_MANAGER',
    });
  });

  it("répond introuvable à un opérateur étranger à l'affaire", async () => {
    const refusal = await refusalOn(
      buildGuard(),
      LayersRoutes,
      'listLayers',
      requestFor(LUCIE),
    );
    expect(refusal).toBeInstanceOf(NotFoundException);
    expect((refusal as NotFoundException).message).toBe(CASE_NOT_FOUND_MESSAGE);
  });

  it('répond introuvable, avec le même message, sur une image inexistante', async () => {
    const refusal = await refusalOn(
      buildGuard(),
      LayersRoutes,
      'listLayers',
      requestFor(MARIE, { params: { fingerprintId: IMAGE_INCONNUE } }),
    );
    expect(refusal).toBeInstanceOf(NotFoundException);
    expect((refusal as NotFoundException).message).toBe(CASE_NOT_FOUND_MESSAGE);
  });

  it("répond introuvable à un jeton dont le compte n'existe pas en base", async () => {
    const refusal = await refusalOn(
      buildGuard(),
      LayersRoutes,
      'listLayers',
      requestFor(undefined),
    );
    expect(refusal).toBeInstanceOf(NotFoundException);
    expect((refusal as NotFoundException).message).toBe(CASE_NOT_FOUND_MESSAGE);
  });

  it('ne pose rien sur la requête quand il refuse', async () => {
    const request = requestFor(LUCIE);
    await refusalOn(buildGuard(), LayersRoutes, 'listLayers', request);
    expect(request.caseAccess).toBeUndefined();
  });
});

describe("CaseAccessGuard — la source de l'identifiant suit la méthode", () => {
  it('autorise une lecture sur le caseId de la requête, pas sur celui du corps', async () => {
    const request = requestFor(MARIE, {
      method: 'GET',
      params: {},
      query: { caseId: AFFAIRE },
      body: { caseId: AFFAIRE_ETRANGERE },
    });
    await expect(
      buildGuard().canActivate(
        contextFor(SubjectRoutes, 'listSubjects', request),
      ),
    ).resolves.toBe(true);
    expect(request.caseAccess).toEqual({
      caseId: AFFAIRE,
      title: 'CASE_OPERATOR',
    });
  });

  it('refuse une écriture dont le corps vise une affaire étrangère, malgré une requête complaisante', async () => {
    const refusal = await refusalOn(
      buildGuard(),
      SubjectRoutes,
      'registerSubject',
      requestFor(MARIE, {
        method: 'POST',
        params: {},
        query: { caseId: AFFAIRE },
        body: { caseId: AFFAIRE_ETRANGERE },
      }),
    );
    expect(refusal).toBeInstanceOf(NotFoundException);
    expect((refusal as NotFoundException).message).toBe(CASE_NOT_FOUND_MESSAGE);
  });

  it("autorise la création d'un calque sur l'image du corps, jamais sur un caseId forgé", async () => {
    const request = requestFor(MARIE, {
      method: 'POST',
      params: {},
      query: { caseId: AFFAIRE },
      body: { fingerprintId: IMAGE, caseId: AFFAIRE },
    });
    await expect(
      buildGuard().canActivate(
        contextFor(LayersRoutes, 'createLayer', request),
      ),
    ).resolves.toBe(true);
    expect(request.caseAccess).toEqual({
      caseId: AFFAIRE,
      title: 'CASE_OPERATOR',
    });
  });
});

describe('CaseAccessGuard — la requête malformée et le câblage fautif', () => {
  it("répond mauvaise requête quand l'appelant n'a pas fourni l'identifiant attendu", async () => {
    const refusal = await refusalOn(
      buildGuard(),
      SubjectRoutes,
      'listSubjects',
      requestFor(MARIE, { params: {}, query: {} }),
    );
    expect(refusal).toBeInstanceOf(BadRequestException);
    expect((refusal as BadRequestException).message).toBe(
      MALFORMED_CASE_SCOPE_MESSAGE,
    );
  });

  it("répond mauvaise requête, et non erreur serveur, sur un identifiant qui n'est pas un UUID", async () => {
    const refusal = await refusalOn(
      buildGuard(),
      LayersRoutes,
      'listLayers',
      requestFor(MARIE, { params: { fingerprintId: 'pas-un-uuid' } }),
    );
    expect(refusal).toBeInstanceOf(BadRequestException);
    expect((refusal as BadRequestException).message).toBe(
      MALFORMED_CASE_SCOPE_MESSAGE,
    );
  });

  it("échoue bruyamment sur une route marquée où aucune ressource n'est désignée", async () => {
    const refusal = await refusalOn(
      buildGuard(),
      ProfileRoutes,
      'readProfile',
      requestFor(MARIE, { params: {} }),
    );
    expect(refusal).toBeInstanceOf(UnresolvableCaseScopeError);
  });

  it('échoue bruyamment sur une route marquée sans tenant prouvé', async () => {
    const refusal = await refusalOn(
      buildGuard(),
      LayersRoutes,
      'listLayers',
      requestFor(MARIE, { tenantContext: undefined }),
    );
    expect(refusal).toBeInstanceOf(UnresolvableCaseScopeError);
  });

  it('relève une panne de la base au lieu de la traduire en introuvable', async () => {
    const request = requestFor(MARIE);
    const refusal = await refusalOn(
      guardWith(new UnreachableCaseAccessReader()),
      LayersRoutes,
      'listLayers',
      request,
    );
    expect(refusal).toBeInstanceOf(Error);
    expect(refusal).not.toBeInstanceOf(NotFoundException);
    expect((refusal as Error).message).toBe('base injoignable');
    expect(request.caseAccess).toBeUndefined();
  });
});
