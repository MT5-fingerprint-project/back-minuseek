import { UNAUDITED_HANDLERS } from '../../../../shared/domain/audit/unaudited-handlers';

const ACTION_LABELS: Record<string, string> = {
  TENANT_PROVISIONED: 'Laboratoire créé',
  CASE_OPENED: 'Dossier ouvert',
  CASE_STATUS_CHANGED: 'Statut du dossier modifié',
  TRACE_UPLOADED: 'Trace déposée et mise sous scellé',
  TRACE_QUALIFIED: 'Trace qualifiée',
  TRACE_DELETED: 'Trace supprimée',
  REFERENCE_PRINT_UPLOADED:
    'Empreinte de référence déposée et mise sous scellé',
  REFERENCE_PRINT_DELETED: 'Empreinte de référence supprimée',
  LAYER_CREATED: "Calque d'amélioration ajouté",
  LAYER_UPDATED: "Calque d'amélioration modifié",
  LAYER_DELETED: "Calque d'amélioration supprimé",
  COMPARISON_EXECUTED: 'Comparaison exécutée',
  HIT_RECORDED: 'Correspondance déclarée par un expert',
  HIT_REMOVED: 'Correspondance retirée par un expert',
  PIECE_VIEWED: 'Pièce consultée',
  FILE_DOWNLOAD_URL_ISSUED: 'Lien de téléchargement émis',
  REPORT_GENERATED: 'Rapport généré et scellé',
  CHAIN_ANCHORED: "Chaîne d'audit horodatée par une autorité externe",
};

const POSITION_LABELS: Record<string, string> = {
  RIGHT_THUMB: 'pouce droit',
  RIGHT_INDEX: 'index droit',
  RIGHT_MIDDLE: 'majeur droit',
  RIGHT_RING: 'annulaire droit',
  RIGHT_LITTLE: 'auriculaire droit',
  LEFT_THUMB: 'pouce gauche',
  LEFT_INDEX: 'index gauche',
  LEFT_MIDDLE: 'majeur gauche',
  LEFT_RING: 'annulaire gauche',
  LEFT_LITTLE: 'auriculaire gauche',
  RIGHT_PALM: 'paume droite',
  LEFT_PALM: 'paume gauche',
  OTHER: 'zone non précisée',
};

const SUBJECT_TYPE_LABELS: Record<string, string> = {
  PERSON_OF_INTEREST: "personne d'intérêt",
  CLOSE_ASSOCIATE: 'proche',
};

const SEX_LABELS: Record<string, string> = {
  MALE: 'masculin',
  FEMALE: 'féminin',
};

export function actionLabel(eventType: string): string {
  return ACTION_LABELS[eventType] ?? eventType;
}

export function positionLabel(position: string | null): string | null {
  return position ? (POSITION_LABELS[position] ?? position) : null;
}

export function subjectTypeLabel(type: string): string {
  return SUBJECT_TYPE_LABELS[type] ?? type;
}

export function sexLabel(sex: string): string {
  return SEX_LABELS[sex] ?? sex;
}

const SCALAR_KEYS_BY_TYPE: Record<string, string[]> = {
  CASE_OPENED: ['caseNumber', 'pvNumber'],
  TRACE_UPLOADED: ['traceId', 'sha256'],
  REFERENCE_PRINT_UPLOADED: ['referencePrintId', 'sha256'],
  TRACE_DELETED: ['traceId', 'reason'],
  REFERENCE_PRINT_DELETED: ['referencePrintId', 'reason'],
  LAYER_CREATED: ['name', 'type', 'zIndex'],
  LAYER_UPDATED: ['name', 'type', 'zIndex'],
  LAYER_DELETED: ['name', 'type'],
  COMPARISON_EXECUTED: ['score', 'hit', 'matchThreshold', 'engineVersion'],
  HIT_RECORDED: [
    'score',
    'traceMinutiae',
    'referenceMinutiae',
    'requiredMinutiae',
  ],
  HIT_REMOVED: ['traceId', 'referencePrintId'],
  REPORT_GENERATED: ['type', 'sha256'],
  CHAIN_ANCHORED: ['headSeq', 'tsaUrl'],
};

function isScalar(value: unknown): boolean {
  return (
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  );
}

/** Détail court d'un acte ; le payload complet vit dans l'annexe de traçabilité. */
export function describeAction(
  eventType: string,
  payload: Record<string, unknown>,
): string | null {
  const keys = SCALAR_KEYS_BY_TYPE[eventType] ?? Object.keys(payload);
  const parts = keys
    .filter((key) => key in payload && isScalar(payload[key]))
    .map((key) => `${key} ${String(payload[key])}`);
  return parts.length > 0 ? parts.join(', ') : null;
}

/**
 * Familles d'actes qu'aucun handler n'écrit encore dans la chaîne, lues dans la
 * liste blanche du garde anti-oubli : la section « non couvert » du rapport
 * rétrécit donc d'elle-même à mesure que l'instrumentation avance.
 */
export function uncoveredActionFamilies(): string[] {
  const families = new Set<string>();
  for (const motive of Object.values(UNAUDITED_HANDLERS)) {
    const family = motive.split('—')[0].trim();
    if (family.length > 0) {
      families.add(family.charAt(0).toUpperCase() + family.slice(1));
    }
  }
  return [...families].sort((left, right) => left.localeCompare(right, 'fr'));
}
