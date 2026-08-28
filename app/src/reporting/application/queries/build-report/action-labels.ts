const ACTION_LABELS: Record<string, string> = {
  TENANT_PROVISIONED: 'Laboratoire créé',
  CASE_OPENED: 'Dossier ouvert',
  CASE_STATUS_CHANGED: 'Statut du dossier modifié',
  CASE_OPERATOR_CHANGED: 'Dossier confié à un autre opérateur',
  CASE_UPDATED: 'Informations du dossier corrigées',
  TRACE_UPLOADED: 'Trace déposée et mise sous scellé',
  TRACE_QUALIFIED: 'Trace qualifiée',
  TRACE_DELETED: 'Trace retirée du dossier',
  REFERENCE_PRINT_UPLOADED:
    'Empreinte de référence déposée et mise sous scellé',
  REFERENCE_PRINT_DELETED: 'Empreinte de référence retirée du dossier',
  TRACE_RESTORED: 'Trace rétablie au dossier',
  REFERENCE_PRINT_RESTORED: 'Empreinte de référence rétablie au dossier',
  REFERENCE_PRINT_IMAGE_DESTROYED:
    'Empreinte de familier détruite à la clôture du dossier',
  LAYER_CREATED: "Calque d'amélioration ajouté",
  LAYER_UPDATED: "Calque d'amélioration modifié",
  LAYER_DELETED: "Calque d'amélioration supprimé",
  COMPARISON_EXECUTED: 'Comparaison exécutée',
  HIT_RECORDED: 'Correspondance déclarée par un expert',
  HIT_REMOVED: 'Identification retirée par un expert',
  REPORT_GENERATED: 'Rapport généré et scellé',
  CHAIN_ANCHORED: "Chaîne d'audit horodatée par une autorité externe",
  SERVICE_HEADER_SAVED: 'En-tête du service enregistré',
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
  PERSON_OF_INTEREST: 'mis en cause',
  CLOSE_ASSOCIATE: 'familier',
  VICTIM: 'victime',
};

const CIVILITY_LABELS: Record<string, string> = {
  MALE: 'Monsieur',
  FEMALE: 'Madame',
};

const TRACE_ORIGIN_LABELS: Record<string, string> = {
  DIGITAL: 'Digitale',
  PALMAR: 'Palmaire',
};

const REVELATION_TECHNIQUE_LABELS: Record<string, string> = {
  OPTICAL_PROCESS: 'Procédé optique',
  FINGERPRINT_POWDER: 'Poudre dactyloscopique',
  DFO: 'DFO',
  NINHYDRIN: 'Ninhydrine',
};

const FEMININE_POSITIONS = new Set(['RIGHT_PALM', 'LEFT_PALM']);

const WITHDRAWAL_MOTIVE_LABELS: Record<string, string> = {
  DUPLICATE: "doublon d'une pièce déjà versée",
  MISFILED: 'pièce versée par erreur dans ce dossier',
  WRONG_ATTRIBUTION: 'rattachement erroné à une personne ou à un doigt',
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

export function withdrawalMotiveLabel(motive: string): string {
  return WITHDRAWAL_MOTIVE_LABELS[motive] ?? motive;
}

export function sexLabel(sex: string): string {
  return SEX_LABELS[sex] ?? sex;
}

export function civilityLabel(sex: string): string {
  return CIVILITY_LABELS[sex] ?? sex;
}

export function traceOriginLabel(origin: string | null): string | null {
  return origin ? (TRACE_ORIGIN_LABELS[origin] ?? origin) : null;
}

export function revelationTechniqueLabel(
  technique: string | null,
): string | null {
  return technique
    ? (REVELATION_TECHNIQUE_LABELS[technique] ?? technique)
    : null;
}

/**
 * « identifiée à l'index droit », « à la paume droite », « au pouce droit » :
 * le rapport écrit la position dans une phrase, pas dans une case.
 */
export function positionWithArticle(position: string | null): string | null {
  const label = positionLabel(position);
  if (label === null) {
    return null;
  }
  if (/^[aeiouyéèêà]/i.test(label)) {
    return `à l'${label}`;
  }
  return position !== null && FEMININE_POSITIONS.has(position)
    ? `à la ${label}`
    : `au ${label}`;
}

const SCALAR_KEYS_BY_TYPE: Record<string, string[]> = {
  CASE_OPENED: ['caseNumber', 'pvNumber'],
  CASE_STATUS_CHANGED: ['previousStatus', 'newStatus', 'reason'],
  TRACE_UPLOADED: ['traceId', 'sha256'],
  REFERENCE_PRINT_UPLOADED: ['referencePrintId', 'sha256'],
  TRACE_DELETED: ['traceId', 'motive'],
  REFERENCE_PRINT_DELETED: ['referencePrintId', 'motive'],
  TRACE_RESTORED: ['withdrawnAt'],
  REFERENCE_PRINT_RESTORED: ['withdrawnAt'],
  REFERENCE_PRINT_IMAGE_DESTROYED: ['referencePrintId', 'fileSha256'],
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
