import { REQUIRED_MINUTIAE } from '../../../../shared/domain/forensics/minutiae';
import {
  ReportCaseHeaderViewModel,
  ReportJournalEntryViewModel,
  TechnicalReportViewModel,
} from '../../../application/report-view-model';
import { frenchCardinal } from '../french-numbers';
import { formatDate, formatLongDay } from '../../../application/report-dates';
import { escapeHtml } from '../html';
import { REPORT_STYLES } from './report-styles';

const FOOTER =
  'Toute reproduction partielle du rapport et des annexes est interdite.';
const NOT_STATED = 'Non renseigné';

function spelled(count: number): string {
  return `${frenchCardinal(count)} (${count})`;
}

function plural(count: number): string {
  return count > 1 ? 's' : '';
}

function tracesCount(count: number): string {
  const word = count === 1 ? 'UNE' : frenchCardinal(count);
  const mark = plural(count);
  return `<b>${word} (${count}) trace${mark} papillaire${mark}</b>`;
}

function quoted(cote: string): string {
  return `« ${escapeHtml(cote)} »`;
}

function joinCotes(cotes: string[]): string {
  const quotedCotes = cotes.map(quoted);
  if (quotedCotes.length <= 1) {
    return quotedCotes.join('');
  }
  return `${quotedCotes.slice(0, -1).join(', ')} et ${quotedCotes[quotedCotes.length - 1]}`;
}

function cotedLabel(cotes: string[]): string {
  return `coté${cotes.length > 1 ? 'es' : 'e'} ${joinCotes(cotes)}`;
}

function referencesSection(header: ReportCaseHeaderViewModel): string {
  const requester = [header.requesterQuality, header.requesterName]
    .filter((part): part is string => part !== null)
    .map(escapeHtml)
    .join(' ');
  const parts = [
    'Demande d’intervention',
    header.requestDate === null
      ? null
      : `en date du <b>${formatLongDay(header.requestDate)}</b>`,
    requester.length > 0 ? `du ${requester}` : null,
    header.requesterService === null
      ? null
      : `en fonction au ${escapeHtml(header.requesterService)}`,
  ].filter((part): part is string => part !== null);

  const request =
    parts.length === 1
      ? '<p class="champ">La demande d\'intervention n\'est pas renseignée.</p>'
      : `<p class="champ">${parts.join(' ')}.</p>`;

  return `
    <h2>Références</h2>
    ${request}
    <p class="champ"><span class="k">Procès-verbal n°</span> : ${escapeHtml(header.pvNumber)}</p>
    <p class="champ"><span class="k">Dossier</span> : ${escapeHtml(header.caseNumber)}</p>`;
}

function offenceDate(header: ReportCaseHeaderViewModel): string | null {
  if (header.offenseDateFrom === null) {
    return null;
  }
  if (header.offenseDateTo === null) {
    return `commis le ${formatLongDay(header.offenseDateFrom)}`;
  }
  return `commis entre le ${formatLongDay(header.offenseDateFrom)} et le ${formatLongDay(
    header.offenseDateTo,
  )}`;
}

function offenceSection(header: ReportCaseHeaderViewModel): string {
  const circumstances = [
    offenceDate(header),
    header.offenseLocation === null
      ? null
      : `au ${escapeHtml(header.offenseLocation)}`,
  ]
    .filter((part): part is string => part !== null)
    .join(' ');
  const parts = [
    header.offenseNature === null ? null : escapeHtml(header.offenseNature),
    circumstances.length > 0 ? circumstances : null,
  ].filter((part): part is string => part !== null);

  const victims =
    header.victims.length === 0
      ? ''
      : header.victims
          .map(
            (victim) =>
              `<p class="champ"><span class="k">Victime</span> : ${escapeHtml(victim)}</p>`,
          )
          .join('');

  return `
    <h2>Nature de l'infraction</h2>
    ${
      parts.length === 0
        ? '<p class="champ">La nature de l\'infraction n\'est pas renseignée.</p>'
        : `<p class="champ">${parts.join(', ')}.</p>`
    }
    <p class="champ"><span class="k">Affaire contre</span> : ${
      header.caseAgainst === null ? NOT_STATED : escapeHtml(header.caseAgainst)
    }</p>
    ${victims}`;
}

function recipientSection(header: ReportCaseHeaderViewModel): string {
  const { recipient } = header;
  return `
    <h2>Destinataire</h2>
    ${
      recipient === null
        ? `<p class="champ">${NOT_STATED}</p>`
        : `<p class="champ">${escapeHtml(recipient.authority)}</p>${
            recipient.attention === null
              ? ''
              : `<p class="champ" style="margin-top:6px">À l'attention du ${escapeHtml(
                  recipient.attention,
                )}</p>`
          }`
    }`;
}

function summarySection(): string {
  return `
    <h2>Sommaire</h2>
    <ul class="rec">
      <li>1. Objet et pièces examinées</li>
      <li>2. Méthodes et techniques employées</li>
      <li>3. Traces papillaires examinées</li>
      <li>4. Exploitabilité et cotation</li>
      <li>5. Comparaisons et identifications</li>
      <li>6. Traitements appliqués aux images et intégrité des pièces</li>
      <li>7. Conclusion</li>
    </ul>
    <p class="champ" style="font-size:9.5pt">Annexe A — Planches des traces papillaires exploitables<br />
    Annexe B — Démonstrations d'identité<br />
    Annexe C — Journal des actes</p>`;
}

function objectSection(model: TechnicalReportViewModel): string {
  const { counts, referenceSubjects, unattachedReferencePrintCount } = model;
  const subjects = referenceSubjects
    .map(
      (subject) =>
        `${escapeHtml(subject.civility)} ${escapeHtml(
          subject.lastName.toUpperCase(),
        )} ${escapeHtml(subject.firstName)} (${escapeHtml(subject.quality)})`,
    )
    .join(' et de ');

  return `
    <h2>1. Objet et pièces examinées</h2>
    <p>Le présent rapport rend compte de l'examen dactyloscopique de
    ${tracesCount(counts.total)} révélée${plural(counts.total)} dans le cadre du dossier
    ${escapeHtml(model.caseHeader.caseNumber)}, de la détermination de leur caractère
    d'exploitabilité, de leur comparaison avec les empreintes de référence versées au dossier,
    et de la démonstration d'identité établie pour celles ayant fait l'objet d'une
    identification.</p>
    ${
      referenceSubjects.length === 0
        ? "<p>Aucune empreinte de référence rattachée à une personne n'a été versée au dossier.</p>"
        : `<p>Les empreintes de ${subjects} ont été ajoutées au dossier.</p>`
    }
    ${
      unattachedReferencePrintCount === 0
        ? ''
        : `<p>${spelled(unattachedReferencePrintCount)} empreinte${
            unattachedReferencePrintCount > 1 ? 's' : ''
          } de référence versée${
            unattachedReferencePrintCount > 1 ? 's' : ''
          } au dossier n'${unattachedReferencePrintCount > 1 ? 'ont' : 'a'} été
          rattachée${unattachedReferencePrintCount > 1 ? 's' : ''} à aucune personne.</p>`
    }`;
}

function methodsSection(): string {
  return `
    <h2>2. Méthodes et techniques employées</h2>`;
}

function examinedTracesSection(model: TechnicalReportViewModel): string {
  const { examinedTraces, exploitability, counts } = model;
  const first = exploitability[0]?.reference;
  const last = exploitability[exploitability.length - 1]?.reference;
  const numbering =
    first === undefined
      ? ''
      : first === last
        ? ` et numérotée ${escapeHtml(first)}`
        : ` et numérotées ${escapeHtml(first)} à ${escapeHtml(last)}`;

  return `
    <h2>3. Traces papillaires examinées</h2>
    ${
      examinedTraces.length === 0
        ? '<p class="empty">Aucune trace papillaire n\'a été versée à ce dossier.</p>'
        : `<p>${tracesCount(counts.total)} ${
            counts.total > 1 ? 'ont' : 'a'
          } été révélée${plural(counts.total)}${numbering}.
           Elles étaient localisées comme suit :</p>
        <table>
          <tr>
            <th style="width:22%">Trace n°</th><th style="width:13%">Origine</th>
            <th>Localisation</th><th style="width:24%">Révélation</th>
          </tr>
          ${examinedTraces
            .map(
              (row) => `
          <tr>
            <td>${escapeHtml(row.label)}</td>
            <td>${escapeHtml(row.origin)}</td>
            <td>${escapeHtml(row.location)}</td>
            <td>${escapeHtml(row.revelationTechnique)}</td>
          </tr>`,
            )
            .join('')}
        </table>`
    }`;
}

function exploitabilitySection(model: TechnicalReportViewModel): string {
  const { exploitability, counts } = model;
  if (exploitability.length === 0) {
    return `<h2>4. Exploitabilité et cotation</h2>
      <p class="empty">Aucune trace papillaire n'a été soumise à examen.</p>`;
  }

  return `
    <h2>4. Exploitabilité et cotation</h2>
    <p>Il a été procédé à un examen méthodique et minutieux ${
      counts.total > 1 ? 'des' : 'de'
    } ${tracesCount(counts.total)} afin de déterminer leur caractère
    d'exploitabilité. Les traces déclarées exploitables reçoivent une cote alphabétique et
    font l'objet de comparaisons ; les traces déclarées inexploitables ne sont pas cotées.</p>
    <table>
      <tr>
        <th style="width:26%">Trace n°</th><th style="width:20%">Exploitabilité</th>
        <th style="width:10%">Cote</th><th>Discrimination</th>
      </tr>
      ${exploitability
        .map(
          (row) => `
      <tr>
        <td>${escapeHtml(row.reference)}</td>
        <td>${escapeHtml(row.exploitability)}</td>
        ${
          row.withdrawal === null
            ? `<td>${escapeHtml(row.cote)}</td><td>${escapeHtml(row.discrimination)}</td>`
            : `<td colspan="2">${escapeHtml(row.withdrawal)}</td>`
        }
      </tr>`,
        )
        .join('')}
    </table>
    <p class="note">La mention « NÉGATIVE » indique que l'expert a comparé la trace papillaire
    à l'ensemble des empreintes de référence du dossier et a déclaré n'y relever aucune
    concordance. La mention « non examinée » indique qu'aucune comparaison n'a encore été
    déclarée sur cette trace : elle ne vaut pas résultat négatif.</p>`;
}

const COMPARATOR_PARAGRAPH = `Le comparateur automatique de la plateforme a été employé dans le
  cadre de la présente affaire. Son emploi a eu pour seul objet de classer les empreintes de
  référence par ordre de ressemblance apparente avec la trace examinée, afin de faciliter la
  lecture des résultats et d'orienter plus rapidement l'examen vers un candidat éventuel. Ce
  classement ne constitue pas un examen comparatif et n'a fondé aucune conclusion : l'examen
  comparatif et la conclusion d'identité relèvent exclusivement de l'expert signataire.`;

function comparisonsSection(model: TechnicalReportViewModel): string {
  const { identifications, negativeCotes, notExaminedCotes } = model;
  const minutiae = `sur la base d'<b>au moins ${spelled(
    REQUIRED_MINUTIAE,
  )} minuties concordantes, sans aucune discordance inexplicable</b>`;

  const negatives =
    negativeCotes.length === 0
      ? ''
      : negativeCotes.length === 1
        ? `<p>La trace papillaire cotée <b>${joinCotes(negativeCotes)}</b> n'a pas été
           identifiée au terme des comparaisons effectuées.</p>`
        : `<p>Les traces papillaires cotées <b>${joinCotes(negativeCotes)}</b> n'ont pas été
           identifiées au terme des comparaisons effectuées.</p>`;

  const notExamined =
    notExaminedCotes.length === 0
      ? ''
      : notExaminedCotes.length === 1
        ? `<p>La trace papillaire cotée <b>${joinCotes(notExaminedCotes)}</b> n'a pas encore
           été examinée.</p>`
        : `<p>Les traces papillaires cotées <b>${joinCotes(notExaminedCotes)}</b> n'ont pas
           encore été examinées.</p>`;

  return `
    <h2>5. Comparaisons et identifications</h2>
    <p>Les comparaisons ont été effectuées entre chaque trace papillaire déclarée exploitable
    et les empreintes de référence du dossier.${
      identifications.length === 0
        ? " Aucune identification n'a été déclarée."
        : ' Elles permettent de conclure aux identifications suivantes :'
    }</p>
    ${model.automaticComparatorUsed ? `<p class="note">${COMPARATOR_PARAGRAPH}</p>` : ''}
    ${
      identifications.length === 0
        ? ''
        : `<ul class="rec">
          ${identifications
            .map(
              (identification, order) => `
          <li>la trace papillaire cotée <b>${quoted(identification.cote)}</b> est identifiée
          <b>${escapeHtml(identification.position)}</b> de ${escapeHtml(
            identification.civility,
          )} ${escapeHtml(identification.lastName.toUpperCase())} ${escapeHtml(
            identification.firstName,
          )}, ${minutiae}${order === identifications.length - 1 ? '.' : ' ;'}</li>`,
            )
            .join('')}
        </ul>`
    }
    ${negatives}
    ${notExamined}
    ${
      identifications.length === 0
        ? ''
        : "<p>La démonstration d'identité de chaque trace identifiée figure en Annexe B.</p>"
    }`;
}

function treatmentsSection(model: TechnicalReportViewModel): string {
  const { imageTreatments, independentTimestampAt } = model;
  return `
    <h2>6. Traitements appliqués aux images et intégrité des pièces</h2>
    <p>Les opérations effectuées sur les images ont eu pour seul but d'améliorer la lisibilité
    des traces papillaires et n'ont en aucune façon modifié le contenu des images d'origine.
    Chaque fichier a été scellé par une empreinte numérique au moment de son entrée au dossier ;
    les traitements sont enregistrés séparément et n'ont jamais réécrit le fichier scellé.</p>
    ${
      imageTreatments.length === 0
        ? '<p class="empty">Aucune image n\'est versée à ce dossier.</p>'
        : `<table>
          <tr>
            <th style="width:24%">Trace n°</th><th style="width:8%">Cote</th>
            <th style="width:18%">Scellée le</th><th>Traitements enregistrés</th>
          </tr>
          ${imageTreatments
            .map(
              (row) => `
          <tr>
            <td>${escapeHtml(row.reference)}</td>
            <td>${escapeHtml(row.cote)}</td>
            <td>${formatDate(row.sealedAt)}</td>
            <td>${escapeHtml(row.treatments)}</td>
          </tr>`,
            )
            .join('')}
        </table>`
    }
    ${
      independentTimestampAt === null
        ? ''
        : `<p>L'ensemble des actes consignés dans ce dossier a été horodaté par un tiers
           indépendant le <b>${formatLongDay(independentTimestampAt)}</b>.</p>`
    }
    <p>Le détail acte par acte figure en Annexe C.</p>`;
}

function conclusionSection(model: TechnicalReportViewModel): string {
  const { counts, identifications, negativeCotes, notExaminedCotes } = model;
  const cotes = model.exploitability
    .filter((row) => row.withdrawal === null && row.cote !== '/')
    .map((row) => row.cote);
  const cotedRange =
    cotes.length === 0
      ? ''
      : cotes.length === 1
        ? `, cotée ${quoted(cotes[0])}`
        : `, cotées de ${quoted(cotes[0])} à ${quoted(cotes[cotes.length - 1])}`;

  const identifiedDetail = identifications
    .map(
      (identification) =>
        `la trace cotée ${quoted(identification.cote)}, identifiée ${escapeHtml(
          identification.position,
        )} de ${escapeHtml(identification.civility)} ${escapeHtml(
          identification.lastName.toUpperCase(),
        )} ${escapeHtml(identification.firstName)}`,
    )
    .join(', et ');

  return `
    <h2>7. Conclusion</h2>
    <p>L'examen des traces papillaires versées au dossier
    ${escapeHtml(model.caseHeader.caseNumber)} permet de faire ressortir les éléments
    suivants :</p>
    <ul class="rec">
      <li>Examen de ${tracesCount(counts.total)}, permettant de conclure à :
        <ul class="rec">
          <li>${tracesCount(counts.exploitable)} exploitable${plural(
            counts.exploitable,
          )}${cotedRange} ;</li>
          <li>${tracesCount(counts.notExploitable)} déclarée${plural(
            counts.notExploitable,
          )} inexploitable${plural(counts.notExploitable)}.</li>
        </ul>
      </li>
      <li>Comparaison avec les empreintes de référence du dossier, permettant de conclure à :
        <ul class="rec">
          <li>${tracesCount(counts.identified)} identifiée${plural(counts.identified)}${
            identifiedDetail.length === 0 ? '' : ` : ${identifiedDetail}`
          } ;</li>
          <li>${tracesCount(counts.negative)} exploitable${plural(
            counts.negative,
          )} non identifiée${plural(counts.negative)}${
            negativeCotes.length === 0 ? '' : `, ${cotedLabel(negativeCotes)}`
          } ;</li>
          <li>${tracesCount(counts.notExamined)} exploitable${plural(
            counts.notExamined,
          )} non encore examinée${plural(counts.notExamined)}${
            notExaminedCotes.length === 0
              ? ''
              : `, ${cotedLabel(notExaminedCotes)}`
          }.</li>
        </ul>
      </li>
    </ul>`;
}

function journalRows(entries: ReportJournalEntryViewModel[]): string {
  return entries
    .map(
      (entry) => `
      <tr>
        <td class="numeric">${entry.seq}</td>
        <td>${escapeHtml(entry.label)}</td>
        <td>${escapeHtml(entry.actorDisplayName)}</td>
        <td>${formatDate(entry.occurredAt)}</td>
        <td>${escapeHtml(entry.detail ?? '—')}</td>
        <td class="hash">${escapeHtml(entry.hash.slice(0, 16))}</td>
      </tr>`,
    )
    .join('');
}

function journalSection(model: TechnicalReportViewModel): string {
  const { journal } = model;
  return `
    <h2>Annexe C — Journal des actes</h2>
    <p>
      Cette section liste tous les actes connus de la plateforme sur ce dossier. Les actes
      chaînés sont ceux dont la trace est scellée dans la chaîne d'audit : ils portent un
      numéro de maillon et l'empreinte de ce maillon, et toute modification postérieure les
      romprait. Les empreintes sont tronquées ici : l'annexe de traçabilité porte leur valeur
      complète, ainsi que le payload intégral de chaque acte. Tous les horodatages sont
      exprimés en temps universel (UTC).
    </p>
    ${
      journal.chained.length === 0
        ? '<p class="empty">Aucun acte chaîné pour ce dossier.</p>'
        : `<table>
            <tr><th>Maillon</th><th>Acte</th><th>Auteur</th><th>Horodatage serveur (UTC)</th><th>Détail</th><th>Empreinte (début)</th></tr>
            ${journalRows(journal.chained)}
          </table>`
    }`;
}

export function renderTechnicalReportHtml(
  model: TechnicalReportViewModel,
): string {
  const { caseHeader } = model;
  return `<!DOCTYPE html>
<html lang="fr">
  <head>
    <meta charset="utf-8" />
    <title>Rapport d'exploitation de traces papillaires — dossier ${escapeHtml(
      caseHeader.caseNumber,
    )}</title>
    <style>${REPORT_STYLES}</style>
  </head>
  <body>
    <h1>RAPPORT D'EXPLOITATION DE TRACES PAPILLAIRES</h1>
    <p class="subtitle">Examen dactyloscopique, comparaison et démonstration d'identité</p>

    ${referencesSection(caseHeader)}
    ${offenceSection(caseHeader)}
    ${recipientSection(caseHeader)}
    ${summarySection()}

    ${objectSection(model)}
    ${methodsSection()}
    ${examinedTracesSection(model)}
    ${exploitabilitySection(model)}
    ${comparisonsSection(model)}
    ${treatmentsSection(model)}
    ${conclusionSection(model)}

    ${journalSection(model)}

    <div class="pied">${FOOTER}</div>
  </body>
</html>`;
}
