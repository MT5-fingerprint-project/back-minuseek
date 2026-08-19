/**
 * Command handlers qui n'appellent pas encore le port AUDIT_TRAIL.
 * Même discipline que UNAUDITED_TABLES : une entrée = une dette, un motif.
 * Un handler instrumenté doit sortir de cette liste, sinon le test de couverture échoue.
 */
export const UNAUDITED_HANDLERS: Record<string, string> = {
  'biometrics/application/commands/compare-trace/compare-trace.handler.ts':
    'comparaison — ticket 5.4, bloqué par la version du moteur (5.3)',
  'biometrics/application/commands/record-hit/record-hit.handler.ts':
    'déclaration de hit — ticket 5.4',
  'biometrics/application/commands/remove-hit/remove-hit.handler.ts':
    'retrait de hit — ticket 5.4',
  'identity-access/application/commands/register-subject/register-subject.handler.ts':
    'enregistrement de sujet — ticket 5.5',
  'identity-access/application/commands/register-user/register-user.handler.ts':
    'comptes du tenant : hors chaîne métier v1 (lot U)',
  'organization/application/commands/create-organization/create-organization.handler.ts':
    'control-plane : le genesis du tenant est écrit par OrganizationInitializer',
  'organization/application/commands/delete-organization/delete-organization.handler.ts':
    'control-plane : la base tenant et sa chaîne disparaissent avec le tenant',
  'organization/application/commands/create-organization-user/create-organization-user.handler.ts':
    'comptes Keycloak du control-plane : hors chaîne métier v1',
  'organization/application/commands/delete-organization-user/delete-organization-user.handler.ts':
    'comptes Keycloak du control-plane : hors chaîne métier v1',
};
