import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { RequestWithCaseAccess } from './case-access.guard';

export function blindVerifierIdOf(
  request: RequestWithCaseAccess,
): string | null {
  if (request.caseAccess?.verificationInProgress !== true) {
    return null;
  }
  return request.currentUser?.id ?? null;
}

export const BlindVerifierId = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string | null =>
    blindVerifierIdOf(ctx.switchToHttp().getRequest<RequestWithCaseAccess>()),
);

export function caseVerifierIdOf(
  request: RequestWithCaseAccess,
): string | null {
  if (request.caseAccess?.title !== 'CASE_VERIFIER') {
    return null;
  }
  return request.currentUser?.id ?? null;
}

export const CaseVerifierId = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string | null =>
    caseVerifierIdOf(ctx.switchToHttp().getRequest<RequestWithCaseAccess>()),
);
