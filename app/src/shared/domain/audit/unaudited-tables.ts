/**
 * Tables de contexte, hors dossier de preuve : leurs dépôts écrivent sans acte,
 * et le garde fail-closed à l'exécution laisse passer leurs mutations.
 * Seule déclaration d'exemption restante — au niveau table, touchée au plus une
 * fois par table de contexte. Chaque entrée cite les handlers qui y écrivent ;
 * instrumentation-coverage.spec.ts vérifie qu'ils existent.
 */
export const UNAUDITED_TABLES: Record<string, string[]> = {
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
