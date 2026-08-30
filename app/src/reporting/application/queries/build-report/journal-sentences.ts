import { AuditEventTypeEnum } from '../../../../shared/domain/audit/audit-event-type.vo';
import { MINUTIA_SETTINGS_TYPES } from '../../../../shared/domain/forensics/minutiae';
import { AuditEventData } from '../../ports/traceability-data.reader';
import {
  caseStatusLabel,
  revelationTechniqueLabel,
  traceOriginLabel,
  withdrawalMotiveLabel,
} from './action-labels';
import { filterSentence, FilterState } from './filter-labels';
import {
  designationOf,
  PieceDesignation,
  UNNAMED_PRINT_FALLBACK,
  UNNAMED_TRACE_FALLBACK,
} from './piece-designations';

export type Designations = Map<string, PieceDesignation>;

type SentenceRule = (event: AuditEventData, named: Designations) => string;

const MINUTIA_TYPES = new Set<string>(MINUTIA_SETTINGS_TYPES);

function text(event: AuditEventData, key: string): string | null {
  const value = event.payload[key];
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function count(event: AuditEventData, key: string): number | null {
  const value = event.payload[key];
  return typeof value === 'number' ? value : null;
}

function trace(event: AuditEventData, named: Designations): PieceDesignation {
  return designationOf(
    named,
    text(event, 'traceId') ?? event.traceId,
    UNNAMED_TRACE_FALLBACK,
  );
}

function print(event: AuditEventData, named: Designations): PieceDesignation {
  return designationOf(
    named,
    text(event, 'referencePrintId'),
    UNNAMED_PRINT_FALLBACK,
  );
}

function withMotive(sentence: string, event: AuditEventData): string {
  const motive = text(event, 'motive') ?? text(event, 'reason');
  return motive === null
    ? sentence
    : `${sentence} — ${withdrawalMotiveLabel(motive)}`;
}

function layerPiece(event: AuditEventData, named: Designations): string {
  return designationOf(named, event.payload.fingerprintId).full;
}

function isMinutia(event: AuditEventData): boolean {
  const settings = event.payload.settings;
  if (typeof settings !== 'object' || settings === null) {
    return false;
  }
  const type = (settings as Record<string, unknown>).type;
  return typeof type === 'string' && MINUTIA_TYPES.has(type);
}

function filterState(
  event: AuditEventData,
  fallback: FilterState,
): FilterState {
  return fallback === 'applied' && event.payload.isVisible === false
    ? 'hidden'
    : fallback;
}

function layerRule(
  fallback: FilterState,
  minutia: string,
  mark: string,
): SentenceRule {
  return (event, named) => {
    const piece = layerPiece(event, named);
    if (event.payload.type === 'FILTER') {
      const settings = (event.payload.settings ?? {}) as Record<
        string,
        unknown
      >;
      return `${filterSentence(
        settings.filterKey,
        settings.value,
        filterState(event, fallback),
      )} sur ${piece}`;
    }
    const preposition = minutia.endsWith('retirée') ? 'de' : 'sur';
    return isMinutia(event)
      ? `${minutia} ${preposition} ${piece}`
      : `${mark} ${mark.endsWith('retiré') ? 'de' : 'sur'} ${piece}`;
  };
}

function dpi(event: AuditEventData, key: string): string | null {
  const value = event.payload[key];
  return typeof value === 'number' ? String(value).replace('.', ',') : null;
}

function calibrationRule(
  piece: (event: AuditEventData, named: Designations) => PieceDesignation,
): SentenceRule {
  return (event, named) => {
    const opening = `Résolution de ${piece(event, named).bare}`;
    const measured = dpi(event, 'resolutionDpi');
    if (measured === null) {
      return `${opening} calibrée`;
    }
    const previous = dpi(event, 'previousResolutionDpi');
    return previous === null
      ? `${opening} fixée à ${measured} ppp`
      : `${opening} corrigée de ${previous} à ${measured} ppp`;
  };
}

const RULES: Record<AuditEventTypeEnum, SentenceRule> = {
  [AuditEventTypeEnum.TENANT_PROVISIONED]: () => 'Création du laboratoire',
  [AuditEventTypeEnum.CASE_OPENED]: (event) => {
    const number = text(event, 'caseNumber');
    const pv = text(event, 'pvNumber');
    if (number === null) {
      return 'Ouverture du dossier';
    }
    return pv === null
      ? `Ouverture du dossier ${number}`
      : `Ouverture du dossier ${number}, procès-verbal ${pv}`;
  },
  [AuditEventTypeEnum.CASE_STATUS_CHANGED]: (event) => {
    const status = text(event, 'newStatus');
    return status === null
      ? 'Statut du dossier modifié'
      : `Statut du dossier porté à ${caseStatusLabel(status)}`;
  },
  [AuditEventTypeEnum.CASE_OPERATOR_CHANGED]: (event) => {
    const name =
      text(event, 'newOperatorName') ?? text(event, 'newOperatorUserId');
    return name === null
      ? 'Dossier confié à un autre opérateur'
      : `Dossier confié à ${name}`;
  },
  [AuditEventTypeEnum.CASE_UPDATED]: () => 'Informations du dossier corrigées',
  [AuditEventTypeEnum.CASE_EXPERTISE_DECLARED]: (event) => {
    const court = text(event, 'courtReference');
    return court === null
      ? 'Dossier déclaré en expertise, serment prêté'
      : `Dossier déclaré en expertise, serment prêté devant ${court}`;
  },
  [AuditEventTypeEnum.CASE_SAISINE_UPDATED]: () =>
    'Saisine du dossier complétée',
  [AuditEventTypeEnum.TRACE_UPLOADED]: (event, named) =>
    `Dépôt de ${trace(event, named).full} et mise sous scellé`,
  [AuditEventTypeEnum.TRACE_QUALIFIED]: (event, named) => {
    const designation = trace(event, named).bare;
    const exploitable = event.payload.exploitable;
    if (exploitable === false) {
      return `${designation} déclarée inexploitable`;
    }
    if (exploitable !== true) {
      return `${designation} qualifiée`;
    }
    const cote = text(event, 'cote');
    return cote === null
      ? `${designation} déclarée exploitable`
      : `${designation} déclarée exploitable, cotée « ${cote} »`;
  },
  [AuditEventTypeEnum.TRACE_DESCRIBED]: (event, named) => {
    const opening = `Fiche renseignée sur ${trace(event, named).bare}`;
    const origin = traceOriginLabel(text(event, 'origin'));
    const location = text(event, 'location');
    const technique = revelationTechniqueLabel(
      text(event, 'revelationTechnique'),
    );
    const stated = [
      origin === null ? null : `origine : ${origin}`,
      location === null ? null : `localisation : « ${location} »`,
      technique === null ? null : `révélation : ${technique}`,
    ].filter((part): part is string => part !== null);
    return stated.length === 0 ? opening : `${opening} — ${stated.join(', ')}`;
  },
  [AuditEventTypeEnum.TRACE_CALIBRATED]: calibrationRule(trace),
  [AuditEventTypeEnum.TRACE_DELETED]: (event, named) =>
    withMotive(`Retrait de ${trace(event, named).full} du dossier`, event),
  [AuditEventTypeEnum.REFERENCE_PRINT_UPLOADED]: (event, named) =>
    `Dépôt de ${print(event, named).full} et mise sous scellé`,
  [AuditEventTypeEnum.REFERENCE_PRINT_CALIBRATED]: calibrationRule(print),
  [AuditEventTypeEnum.REFERENCE_PRINT_DELETED]: (event, named) =>
    withMotive(`Retrait de ${print(event, named).full} du dossier`, event),
  [AuditEventTypeEnum.TRACE_RESTORED]: (event, named) =>
    `${trace(event, named).full} rétablie au dossier`,
  [AuditEventTypeEnum.REFERENCE_PRINT_RESTORED]: (event, named) =>
    `${print(event, named).full} rétablie au dossier`,
  [AuditEventTypeEnum.REFERENCE_PRINT_IMAGE_DESTROYED]: (event, named) =>
    `Image de ${print(event, named).full} détruite à la clôture du dossier`,
  [AuditEventTypeEnum.LAYER_CREATED]: layerRule(
    'applied',
    'Minutie relevée',
    'Repère tracé',
  ),
  [AuditEventTypeEnum.LAYER_UPDATED]: layerRule(
    'applied',
    'Minutie déplacée',
    'Repère modifié',
  ),
  [AuditEventTypeEnum.LAYER_DELETED]: layerRule(
    'removed',
    'Minutie retirée',
    'Repère retiré',
  ),
  [AuditEventTypeEnum.COMPARISON_EXECUTED]: (event, named) =>
    `Classement des empreintes de référence par ressemblance apparente pour ${
      trace(event, named).full
    }`,
  [AuditEventTypeEnum.HIT_RECORDED]: (event, named) => {
    const declared = `Identification déclarée : ${
      trace(event, named).full
    } identifiée à ${print(event, named).full}`;
    const minutiae = count(event, 'traceMinutiae');
    return minutiae === null
      ? declared
      : `${declared}, sur la base de ${minutiae} minuties concordantes`;
  },
  [AuditEventTypeEnum.HIT_REMOVED]: (event, named) =>
    `Identification retirée : ${trace(event, named).full} / ${
      print(event, named).full
    }`,
  [AuditEventTypeEnum.REPORT_GENERATED]: () =>
    "Édition d'un rapport d'exploitation de traces papillaires",
  [AuditEventTypeEnum.CHAIN_ANCHORED]: () =>
    'Horodatage du registre du laboratoire par une autorité extérieure',
  [AuditEventTypeEnum.SERVICE_HEADER_SAVED]: () =>
    'En-tête du service enregistré',
  [AuditEventTypeEnum.CASE_VERIFICATION_REQUESTED]: (event) => {
    const name = text(event, 'verifierName') ?? text(event, 'verifierUserId');
    return name === null
      ? 'Vérification du dossier confiée à un second regard'
      : `Vérification du dossier confiée à ${name}`;
  },
  [AuditEventTypeEnum.VERIFICATION_CONCLUSION_STATED]: (event, named) => {
    const designation = trace(event, named).bare;
    const exploitable = text(event, 'exploitability');
    if (exploitable === 'NOT_EXPLOITABLE') {
      return `Le vérificateur déclare ${designation} inexploitable`;
    }
    if (exploitable !== 'EXPLOITABLE') {
      return `Conclusion du vérificateur rendue sur ${designation}`;
    }
    const identified = text(event, 'identifiedReferencePrintId');
    return identified === null
      ? `Le vérificateur déclare ${designation} exploitable, sans identification`
      : `Le vérificateur déclare ${designation} exploitable et identifiée à ${
          designationOf(named, identified, UNNAMED_PRINT_FALLBACK).full
        }`;
  },
  [AuditEventTypeEnum.CASE_VERIFICATION_COMPLETED]: (event) => {
    const verdict = text(event, 'verdict');
    if (verdict === 'CONCORDANT') {
      return 'Vérification close : les conclusions concordent';
    }
    if (verdict !== 'DISCORDANT') {
      return 'Vérification close';
    }
    const diverging = count(event, 'discordantTraceCount');
    const opening = 'Vérification close : les conclusions divergent';
    return diverging === null || diverging === 0
      ? opening
      : `${opening} sur ${diverging} trace${diverging > 1 ? 's' : ''}`;
  },
};

export function journalSentence(
  event: AuditEventData,
  named: Designations,
): string {
  const rule = RULES[event.eventType as AuditEventTypeEnum] as
    | SentenceRule
    | undefined;
  return rule ? rule(event, named) : `Acte enregistré : ${event.eventType}`;
}
