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

export const REVELATION_TECHNIQUE_SEQUENCE = [
  'OPTICAL_PROCESS',
  'FINGERPRINT_POWDER',
  'DFO',
  'NINHYDRIN',
];

const FEMININE_POSITIONS = new Set(['RIGHT_PALM', 'LEFT_PALM']);

const WITHDRAWAL_MOTIVE_LABELS: Record<string, string> = {
  DUPLICATE: "doublon d'une pièce déjà versée",
  MISFILED: 'pièce versée par erreur dans ce dossier',
  WRONG_ATTRIBUTION: 'rattachement erroné à une personne ou à un doigt',
};

const VERIFICATION_RESULT_LABELS: Record<string, string> = {
  CONCORDANT: 'Conclusions concordantes',
  DISCORDANT: 'Discordance — un troisième examen est nécessaire',
};

const VERIFICATION_VERDICT_LABELS: Record<string, string> = {
  CONCORDANT: 'Vérification concordante',
  DISCORDANT: 'Vérification discordante',
};

const SEX_LABELS: Record<string, string> = {
  MALE: 'masculin',
  FEMALE: 'féminin',
};

export function positionLabel(position: string | null): string | null {
  return position ? (POSITION_LABELS[position] ?? position) : null;
}

export function subjectTypeLabel(type: string): string {
  return SUBJECT_TYPE_LABELS[type] ?? type;
}

export function withdrawalMotiveLabel(motive: string): string {
  return WITHDRAWAL_MOTIVE_LABELS[motive] ?? motive;
}

export function verificationResultLabel(outcome: string | null): string {
  if (outcome === null) return 'Non conclue par le vérificateur';
  return VERIFICATION_RESULT_LABELS[outcome] ?? outcome;
}

export function verificationVerdictLabel(status: string): string {
  return VERIFICATION_VERDICT_LABELS[status] ?? status;
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

export function positionOf(position: string | null): string | null {
  const label = positionLabel(position);
  if (label === null) {
    return null;
  }
  if (/^[aeiouyéèêà]/i.test(label)) {
    return `de l'${label}`;
  }
  return position !== null && FEMININE_POSITIONS.has(position)
    ? `de la ${label}`
    : `du ${label}`;
}

const CASE_STATUS_LABELS: Record<string, string> = {
  OPEN: 'ouvert',
  IN_PROGRESS: 'en cours',
  UNDER_REVIEW: 'en vérification',
  CLOSED: 'clos',
};

export function caseStatusLabel(status: string): string {
  return CASE_STATUS_LABELS[status] ?? status;
}
