// table that are exempted from audit are listed in `UNAUDITED_TABLES` and are not considered "unaudited" when mutated. This is a temporary measure to allow certain operations to proceed without audit events while the system is being developed.
export const UNAUDITED_TABLES: Record<string, string[]> = {
  InvestigationCase: [
    'investigation/application/commands/open-investigation-case/open-investigation-case.handler.ts',
  ],
  Layer: [
    'biometrics/application/commands/create-layer/create-layer.handler.ts',
    'biometrics/application/commands/update-layer/update-layer.handler.ts',
    'biometrics/application/commands/delete-layer/delete-layer.handler.ts',
  ],
  Matching: [
    'biometrics/application/commands/compare-trace/compare-trace.handler.ts',
  ],
  Hit: [
    'biometrics/application/commands/record-hit/record-hit.handler.ts',
    'biometrics/application/commands/remove-hit/remove-hit.handler.ts',
  ],
  Subject: [
    'identity-access/application/commands/register-subject/register-subject.handler.ts',
  ],
  User: [
    'identity-access/application/commands/register-user/register-user.handler.ts',
  ],
  PersonalData: [
    'identity-access/application/commands/register-user/register-user.handler.ts',
  ],
};
