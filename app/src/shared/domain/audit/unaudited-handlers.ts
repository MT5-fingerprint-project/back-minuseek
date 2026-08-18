/**
 * Command handlers qui n'appellent pas encore le port AUDIT_TRAIL.
 * Même discipline que UNAUDITED_TABLES : une entrée = une dette, un motif.
 * Un handler instrumenté doit sortir de cette liste, sinon le test de couverture échoue.
 */
export const UNAUDITED_HANDLERS: Record<string, string> = {
  'biometrics/application/commands/upload-trace/upload-trace.handler.ts':
    'dépôt de trace — tickets 4.1 et 5.1',
  'biometrics/application/commands/delete-trace/delete-trace.handler.ts':
    'suppression de trace — ticket 5.1',
  'biometrics/application/commands/upload-reference-print/upload-reference-print.handler.ts':
    'dépôt de référence — tickets 4.1 et 5.1',
  'biometrics/application/commands/delete-reference-print/delete-reference-print.handler.ts':
    'suppression de référence — ticket 5.1',
  'biometrics/application/commands/create-layer/create-layer.handler.ts':
    'calques — ticket 5.2',
  'biometrics/application/commands/update-layer/update-layer.handler.ts':
    'calques — ticket 5.2',
  'biometrics/application/commands/delete-layer/delete-layer.handler.ts':
    'calques — ticket 5.2',
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
  'investigation/application/commands/open-investigation-case/open-investigation-case.handler.ts':
    'ouverture de dossier — ticket 5.1',
  'organization/application/commands/create-organization/create-organization.handler.ts':
    'control-plane : le genesis du tenant est écrit par OrganizationInitializer',
  'organization/application/commands/delete-organization/delete-organization.handler.ts':
    'control-plane : la base tenant et sa chaîne disparaissent avec le tenant',
  'organization/application/commands/create-organization-user/create-organization-user.handler.ts':
    'comptes Keycloak du control-plane : hors chaîne métier v1',
  'organization/application/commands/delete-organization-user/delete-organization-user.handler.ts':
    'comptes Keycloak du control-plane : hors chaîne métier v1',
};
