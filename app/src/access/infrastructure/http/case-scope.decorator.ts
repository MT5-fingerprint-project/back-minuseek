import { SetMetadata } from '@nestjs/common';

export const CASE_SCOPE_KEY = 'caseScope';

export type CaseScope =
  | { mode: 'GUARDED' }
  | { mode: 'LIST' }
  | { mode: 'NONE'; reason: string }
  | { mode: 'CHECKED_IN_HANDLER'; reason: string };

export const CaseScoped = () =>
  SetMetadata<string, CaseScope>(CASE_SCOPE_KEY, { mode: 'GUARDED' });

export const CaseScopedList = () =>
  SetMetadata<string, CaseScope>(CASE_SCOPE_KEY, { mode: 'LIST' });

export const NoCaseScope = (reason: string) =>
  SetMetadata<string, CaseScope>(CASE_SCOPE_KEY, { mode: 'NONE', reason });

export const CaseScopeCheckedInHandler = (reason: string) =>
  SetMetadata<string, CaseScope>(CASE_SCOPE_KEY, {
    mode: 'CHECKED_IN_HANDLER',
    reason,
  });
