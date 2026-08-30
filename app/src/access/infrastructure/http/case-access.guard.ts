import {
  BadRequestException,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PATH_METADATA } from '@nestjs/common/constants';
import { Reflector } from '@nestjs/core';
import type { UserReadModel } from '../../../identity-access/application/queries/get-user-by-provider-id/user-read-model';
import { UserRole } from '../../../identity-access/domain/user/value-objects/user-role.vo';
import type { RequestWithCurrentUser } from '../../../identity-access/infrastructure/http/current-user.guard';
import { TenantContextService } from '../../../tenancy/application/tenant-context.service';
import { CaseAccessDeniedError } from '../../application/case-access-denied.error';
import {
  CaseAccessService,
  type CaseRequester,
  type GrantedCaseAccess,
} from '../../application/case-access.service';
import { resolveCaseScope, routeSegments } from './case-scope-target';
import { CASE_SCOPE_KEY, type CaseScope } from './case-scope.decorator';
import { UnresolvableCaseScopeError } from './unresolvable-case-scope.error';

export const CASE_NOT_FOUND_MESSAGE = 'Affaire introuvable';
export const MALFORMED_CASE_SCOPE_MESSAGE =
  "L'affaire visée n'est pas identifiable dans la requête";
export const CASE_ADMINISTRATION_FORBIDDEN_MESSAGE =
  "Une mission de vérification n'ouvre pas l'administration de l'affaire";

export type RequestWithCaseAccess = RequestWithCurrentUser & {
  caseAccess?: GrantedCaseAccess;
};

@Injectable()
export class CaseAccessGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly caseAccess: CaseAccessService,
    private readonly tenantContext: TenantContextService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const scope = this.reflector.getAllAndOverride<CaseScope | undefined>(
      CASE_SCOPE_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (scope?.mode !== 'GUARDED' && scope?.mode !== 'ADMINISTRATION') {
      return true;
    }

    const request = context.switchToHttp().getRequest<RequestWithCaseAccess>();
    const segments = routeSegments([
      pathOf(context.getClass()),
      pathOf(context.getHandler()),
    ]);

    const tenant = request.tenantContext;
    if (!tenant) {
      throw new UnresolvableCaseScopeError(segments.join('/'));
    }

    const resolution = resolveCaseScope({
      segments,
      method: request.method,
      params: request.params,
      query: request.query,
      body: request.body as unknown,
    });
    if (resolution.outcome === 'ROUTE_UNWIRABLE') {
      throw new UnresolvableCaseScopeError(segments.join('/'));
    }
    if (resolution.outcome === 'MALFORMED_REQUEST') {
      throw new BadRequestException(MALFORMED_CASE_SCOPE_MESSAGE);
    }

    const requester = requesterOf(request.currentUser);
    if (!requester) {
      throw new NotFoundException(CASE_NOT_FOUND_MESSAGE);
    }

    let granted: GrantedCaseAccess;
    try {
      granted = await this.tenantContext.run(tenant, () =>
        this.caseAccess.assertAccessTo(requester, resolution.target),
      );
    } catch (error) {
      if (error instanceof CaseAccessDeniedError) {
        throw new NotFoundException(CASE_NOT_FOUND_MESSAGE);
      }
      throw error;
    }

    if (scope.mode === 'ADMINISTRATION' && granted.title === 'CASE_VERIFIER') {
      throw new ForbiddenException(CASE_ADMINISTRATION_FORBIDDEN_MESSAGE);
    }

    request.caseAccess = granted;
    return true;
  }
}

function requesterOf(
  currentUser: UserReadModel | undefined,
): CaseRequester | undefined {
  if (!currentUser) {
    return undefined;
  }
  return {
    id: currentUser.id,
    role: UserRole.from(currentUser.role).getValue(),
  };
}

function pathOf(target: object): string | undefined {
  const path: unknown = Reflect.getMetadata(PATH_METADATA, target);
  return typeof path === 'string' ? path : undefined;
}
