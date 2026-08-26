import type { CaseScopeTarget } from './case-access.reader';

export class CaseAccessDeniedError extends Error {
  constructor(readonly target: CaseScopeTarget) {
    super(`Aucun accès à ${target.kind} ${target.id}`);
  }
}
