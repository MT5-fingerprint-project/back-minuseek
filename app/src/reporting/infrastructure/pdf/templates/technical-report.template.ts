import { REQUIRED_MINUTIAE } from '../../../../shared/domain/forensics/minutiae';
import {
  ReportCaseHeaderViewModel,
  ReportContributorViewModel,
  ReportDemonstrationViewModel,
  ReportExploitabilityViewModel,
  ReportIdentificationViewModel,
  ReportIntegrityViewModel,
  ReportJournalSummaryViewModel,
  ReportJournalViewModel,
  ReportPieceIntegrityViewModel,
  ReportSaisineViewModel,
  ReportTreatmentViewModel,
  ReportVerificationActGroupViewModel,
  ReportVerificationViewModel,
  TechnicalReportViewModel,
} from '../../../application/report-view-model';
import {
  journalRows,
  JournalRow,
} from '../../../application/queries/build-report/journal-annex.builder';
import {
  NEGATIVE_MENTION,
  NOT_EXAMINED_MENTION,
} from '../../../application/queries/build-report/trace-verdicts';
import { bornPhrase } from '../../../application/queries/build-report/civil-identity';
import { frenchCardinal } from '../french-numbers';
import {
  formatDay,
  formatDayTime,
  formatHourMinute,
  formatLongDay,
} from '../../../application/report-dates';
import { escapeHtml } from '../html';
import { toRoman } from '../roman-numerals';
import { renderLetterhead } from './letterhead-block';
import { renderLocationPlate, renderPlate } from './plate-block';
import { REPORT_STYLES } from './report-styles';
import { REVELATION_TECHNIQUE_TEXTS } from './revelation-techniques';

export const FOOTER_NOTICE =
  'Toute reproduction partielle du rapport et des annexes est interdite.';

export function reportFooterText(reportNumber: string): string {
  return `${FOOTER_NOTICE} Rapport ${reportNumber}.`;
}

function withDefiniteArticle(grade: string): string {
  return /^[aàâäeéèêëiîïoôöuùûüy]/i.test(grade) ? `l'${grade}` : `le ${grade}`;
}

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

function referencesSection(model: TechnicalReportViewModel): string {
  const header = model.caseHeader;
  const { previousDocument } = model;
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
    ${
      header.interventionDate === null
        ? ''
        : `<p class="champ"><span class="k">Date d’intervention</span> : ${formatLongDay(
            header.interventionDate,
          )}</p>`
    }
    <p class="champ"><span class="k">Procès-verbal n°</span> : ${escapeHtml(header.pvNumber)}</p>
    <p class="champ"><span class="k">Dossier</span> : ${escapeHtml(header.caseNumber)}</p>
    <p class="champ"><span class="k">Rapport n°</span> : ${escapeHtml(model.header.reportNumber)}</p>
    <p class="champ">${
      previousDocument === null
        ? 'Le présent rapport est le premier établi sur ce dossier.'
        : `Le présent rapport succède au rapport ${escapeHtml(
            previousDocument.number,
          )}, établi le ${formatDay(previousDocument.issuedAt)}.`
    }</p>`;
}

function contributorsSentence(
  contributors: ReportContributorViewModel[],
): string {
  if (contributors.length === 0) {
    return '';
  }
  const named = contributors
    .map((contributor) =>
      contributor.grade === null
        ? escapeHtml(contributor.displayName)
        : `${escapeHtml(withDefiniteArticle(contributor.grade))} ${escapeHtml(
            contributor.displayName,
          )}`,
    )
    .join(', ');
  return `<p>Ont concouru à ces opérations : ${named}.</p>`;
}

function signatureSection(model: TechnicalReportViewModel): string {
  const { signer } = model;
  return `
    <div class="sign">
      ${
        model.header.signatureCity === null
          ? `Fait le ${formatDay(model.header.generatedAt)}`
          : `Fait à ${escapeHtml(model.header.signatureCity)}, le ${formatDay(
              model.header.generatedAt,
            )}`
      }<div class="vide"></div>
      ${escapeHtml(signer.grade)}<br />
      ${escapeHtml(signer.lastName.toLocaleUpperCase('fr'))} ${escapeHtml(
        signer.firstName,
      )} — Matricule ${escapeHtml(signer.serviceNumber)}
    </div>`;
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

  const against =
    header.caseAgainst === null
      ? ''
      : `<p class="champ"><span class="k">Affaire contre</span> : ${escapeHtml(
          header.caseAgainst,
        )}</p>`;
  const nature =
    parts.length === 0 ? '' : `<p class="champ">${parts.join(', ')}.</p>`;
  if (nature.length === 0 && against.length === 0 && victims.length === 0) {
    return '';
  }

  return `
    <h2>Nature de l'infraction</h2>
    ${nature}
    ${against}
    ${victims}`;
}

function recipientSection(header: ReportCaseHeaderViewModel): string {
  const { recipient } = header;
  if (recipient === null) {
    return '';
  }
  return `
    <h2>Destinataire</h2>
    <p class="champ">${escapeHtml(recipient.authority)}</p>
    ${
      recipient.attention === null
        ? ''
        : `<p class="champ" style="margin-top:6px">À l'attention du ${escapeHtml(
            recipient.attention,
          )}</p>`
    }`;
}

interface ReportBodySection {
  title: string;
  content: string;
}

function bodySections(model: TechnicalReportViewModel): ReportBodySection[] {
  return [
    { title: 'Saisine', content: saisineSection(model) },
    { title: 'Objet et pièces examinées', content: objectSection(model) },
    {
      title: 'Méthodes et techniques employées',
      content: methodsSection(model),
    },
    {
      title: 'Traces papillaires examinées',
      content: examinedTracesSection(model),
    },
    {
      title: 'Exploitabilité et cotation',
      content: exploitabilitySection(model),
    },
    {
      title: 'Comparaisons et identifications',
      content: comparisonsSection(model),
    },
    {
      title: 'Traitements appliqués aux images et intégrité des pièces',
      content: integritySection(model),
    },
    { title: 'Conclusion', content: conclusionSection(model) },
  ];
}

function renderBodySections(sections: ReportBodySection[]): string {
  return sections
    .map(
      (section, order) =>
        `<h2>${order + 1}. ${section.title}</h2>${section.content}`,
    )
    .join('');
}

function summarySection(
  model: TechnicalReportViewModel,
  sections: ReportBodySection[],
): string {
  const annexes = [
    model.annexA.length === 0
      ? null
      : 'Annexe A — Localisation des traces papillaires',
    model.annexB.length === 0 ? null : "Annexe B — Démonstrations d'identité",
    'Annexe C — Journal des actes',
    model.verifications.length === 0
      ? null
      : 'Annexe D — Vérification par un second regard',
  ].filter((line): line is string => line !== null);

  return `
    <h2>Sommaire</h2>
    <ul class="rec">
      ${sections
        .map((section, order) => `<li>${order + 1}. ${section.title}</li>`)
        .join('')}
    </ul>
    <p class="champ" style="font-size:9.5pt">${annexes.join('<br />')}</p>`;
}

function annexTitlePage(
  title: string,
  model: TechnicalReportViewModel,
): string {
  return `
    <div class="annexe-titre">
      <h2>${escapeHtml(title)}</h2>
      <p class="champ">Dossier ${escapeHtml(
        model.caseHeader.caseNumber,
      )} — procès-verbal ${escapeHtml(model.caseHeader.pvNumber)}</p>
    </div>`;
}

function locationCaption(cote: string, location: string | null): string {
  return location === null
    ? `Trace papillaire cotée ${quoted(cote)}.`
    : `Trace papillaire cotée ${quoted(cote)}, révélée ${location}.`;
}

function annexASection(model: TechnicalReportViewModel): string {
  if (model.annexA.length === 0) {
    return '';
  }
  const plates = model.annexA
    .map((plate, order) =>
      renderLocationPlate({
        title: `Planche ${toRoman(order + 1)}`,
        locationPhoto: plate.locationPhoto,
        trace: plate.trace,
        cote: plate.cote,
        caption: locationCaption(plate.cote, plate.location),
      }),
    )
    .join('');

  return `
    ${annexTitlePage('Annexe A — Localisation des traces papillaires', model)}
    ${plates}`;
}

function referencePrintCaption(
  demonstration: ReportDemonstrationViewModel,
): string {
  const { subject, position } = demonstration;
  const named =
    subject === null
      ? null
      : `${subject.civility} ${subject.lastName.toLocaleUpperCase('fr')} ${
          subject.firstName
        }`;
  const where =
    position === null
      ? null
      : position.charAt(0).toLocaleUpperCase('fr') + position.slice(1);

  if (where !== null) {
    return named === null ? `${where}.` : `${where} de ${named}.`;
  }
  return named === null
    ? 'Empreinte de référence.'
    : `Empreinte de référence de ${named}.`;
}

function annexBSection(model: TechnicalReportViewModel): string {
  if (model.annexB.length === 0) {
    return '';
  }

  let rank = 0;
  const plates = model.annexB
    .map((demonstration) => {
      const subtitle = `Démonstration d'identité — trace papillaire cotée ${quoted(
        demonstration.cote,
      )}`;
      const marked = demonstration.trace.marks.length;
      const retouched = demonstration.rawTrace !== null;
      const pages: string[] = [];

      if (demonstration.rawTrace !== null) {
        pages.push(
          renderPlate({
            title: `Planche ${toRoman(++rank)}`,
            subtitle,
            image: demonstration.rawTrace,
            marks: [],
            cote: demonstration.cote,
            caption: `Trace papillaire cotée ${quoted(
              demonstration.cote,
            )}, telle qu’elle a été scellée au dossier.`,
          }),
        );
      }

      const traceState = retouched
        ? `, après les traitements enregistrés au dossier`
        : '';
      pages.push(
        renderPlate({
          title: `Planche ${toRoman(++rank)}`,
          subtitle,
          image: demonstration.trace.image,
          marks: demonstration.trace.marks,
          cote: demonstration.cote,
          caption:
            marked === 0
              ? `Trace papillaire cotée ${quoted(
                  demonstration.cote,
                )}${traceState}.`
              : `Trace papillaire cotée ${quoted(
                  demonstration.cote,
                )}${traceState}. ${spelled(marked)} minuties concordantes numérotées.`,
        }),
      );

      const who = referencePrintCaption(demonstration);
      pages.push(
        renderPlate({
          title: `Planche ${toRoman(++rank)}`,
          subtitle,
          image: demonstration.referencePrint.image,
          marks: demonstration.referencePrint.marks,
          cote: null,
          caption:
            marked === 0
              ? who
              : `${who} Chaque numéro désigne le même détail que sur la planche précédente : l'appariement a été établi point par point par l'expert.`,
        }),
      );

      return pages.join('');
    })
    .join('');

  return `
    ${annexTitlePage("Annexe B — Démonstrations d'identité", model)}
    ${plates}`;
}

function identifiedPerson(
  identification: ReportIdentificationViewModel,
): string {
  const { subject } = identification;
  if (subject === null) {
    return "d'une empreinte de référence non rattachée à une personne";
  }
  const named = `${escapeHtml(subject.civility)} ${escapeHtml(
    subject.lastName.toLocaleUpperCase('fr'),
  )} ${escapeHtml(subject.firstName)}`;
  const born = bornPhrase(subject.sex, subject.birthDate, subject.birthPlace);
  return born === null ? `de ${named}` : `de ${named}, ${escapeHtml(born)}`;
}

function identifiedAs(identification: ReportIdentificationViewModel): string {
  const where =
    identification.position === null
      ? 'à une empreinte'
      : `<b>${escapeHtml(identification.position)}</b>`;
  return `${where} ${identifiedPerson(identification)}`;
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

function methodsSection(model: TechnicalReportViewModel): string {
  const described = model.revelationTechniques
    .map((technique) => REVELATION_TECHNIQUE_TEXTS[technique])
    .filter((text) => text !== undefined);

  return `
    ${
      described.length === 0
        ? `<p class="empty">Aucune technique de révélation n'est enregistrée pour les traces de ce dossier.</p>`
        : `<p>Les techniques décrites ci-dessous sont celles effectivement employées sur les traces papillaires examinées dans le présent dossier.</p>
        ${described
          .map(
            (text) => `
        <h3>${text.title}</h3>
        <p>${text.paragraph}</p>`,
          )
          .join('')}`
    }`;
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

function mentionsNote(exploitability: ReportExploitabilityViewModel[]): string {
  const mentioned = new Set(
    exploitability
      .filter((row) => row.withdrawal === null)
      .map((row) => row.discrimination),
  );
  const notes = [
    mentioned.has(NEGATIVE_MENTION)
      ? `La mention « NÉGATIVE » indique que l'expert a comparé la trace papillaire
    à l'ensemble des empreintes de référence du dossier et a déclaré n'y relever aucune
    concordance.`
      : null,
    mentioned.has(NOT_EXAMINED_MENTION)
      ? `La mention « non examinée » indique qu'aucune comparaison n'a encore été
    déclarée sur cette trace : elle ne vaut pas résultat négatif.`
      : null,
  ].filter((note): note is string => note !== null);

  return notes.length === 0 ? '' : `<p class="note">${notes.join(' ')}</p>`;
}

function exploitabilitySection(model: TechnicalReportViewModel): string {
  const { exploitability, counts } = model;
  if (exploitability.length === 0) {
    return `<p class="empty">Aucune trace papillaire n'a été soumise à examen.</p>`;
  }

  return `
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
    ${mentionsNote(exploitability)}`;
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
          ${identifiedAs(identification)}, ${minutiae}${
            order === identifications.length - 1 ? '.' : ' ;'
          }</li>`,
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

const INTEGRITY_PREAMBLE = [
  "Les images de ce dossier sont conservées dans l'état où elles ont été reçues. Au moment du dépôt, chaque fichier est enregistré sous une désignation qui lui est propre, et son empreinte numérique est inscrite au registre chronologique du laboratoire dans la même opération indivisible. Deux fichiers différents, ne serait-ce que d'un point, donnent deux empreintes différentes ; l'empreinte, elle, ne permet pas de reconstituer l'image.",
  "Le logiciel ne comporte aucune fonction permettant de remplacer le fichier d'une pièce. L'enregistrement est refusé si la désignation est déjà occupée, et aucune commande de l'application ne modifie ni le fichier, ni l'empreinte inscrite. Une pièce peut être retirée du dossier, et ce retrait est lui-même inscrit au registre ; elle ne peut pas être échangée contre une autre.",
  "Les traitements effectués ne sont destinés qu'à améliorer la lisibilité. Ils ne sont pas appliqués au fichier original. Les modifications apportées sont enregistrées sous forme de réglages, avec leur valeur, la date à laquelle ils ont été posés et le nom de l'agent qui les a posés.",
  'Les images originales sont fournies en pièce jointe du présent rapport.Elles peuvent être communiquées à toute autorité judiciaire ou administrative sur demande.',

  "Le registre chronologique est en écriture seule : la base de données refuse la modification comme la suppression d'une inscription déjà faite, et chaque inscription reprend l'empreinte de la précédente, de sorte qu'une inscription retouchée rendrait toutes les suivantes incohérentes. Les dates ci-dessous sont exprimées en temps universel (UTC).",
];

const INTEGRITY_SCOPE =
  "Ce qui précède établit que les fichiers examinés sont ceux qui ont été reçus, et que les opérations énumérées sont celles qui ont été enregistrées, dans cet ordre et à ces dates. Cela n'établit ni la qualité de la prise de vue, ni l'origine de l'image avant son dépôt au laboratoire.";

function integrityWarning(integrity: ReportIntegrityViewModel): string {
  if (integrity.firstBrokenEntryNumber !== null) {
    return `<p class="alerte">Une vérification du registre du laboratoire a été effectuée à l'édition du présent rapport et a relevé une anomalie à l'inscription n° ${integrity.firstBrokenEntryNumber}. Les affirmations du présent chapitre doivent être tenues pour non vérifiées jusqu'à examen.</p>`;
  }
  if (integrity.anchorsFailed > 0) {
    return `<p class="alerte">Une vérification effectuée à l'édition du présent rapport n'a pas pu valider ${integrity.anchorsFailed} horodatage(s) extérieur(s). Les empreintes et l'enchaînement des inscriptions restent vérifiés ; les dates extérieures mentionnées ci-dessous, non.</p>`;
  }
  return '';
}

function treatmentState(treatment: ReportTreatmentViewModel): string {
  if (treatment.removedAt !== null) {
    return `Retiré le ${formatDayTime(treatment.removedAt)}`;
  }
  return treatment.hiddenAtEdition ? 'Masqué' : 'Toujours posé';
}

function treatmentsBlock(piece: ReportPieceIntegrityViewModel): string {
  if (piece.treatments.length === 0) {
    return "<p>Aucun traitement n'a été appliqué à cette image.</p>";
  }
  return `
      <p>Traitements enregistrés :</p>
      <table>
        <tr>
          <th>Traitement</th><th style="width:20%">Posé le</th>
          <th style="width:20%">Par</th><th style="width:28%">État à l'édition</th>
        </tr>
        ${piece.treatments
          .map(
            (treatment) => `
        <tr>
          <td>${escapeHtml(treatment.sentence)}</td>
          <td>${formatDayTime(treatment.appliedAt)}</td>
          <td>${escapeHtml(treatment.actorDisplayName)}</td>
          <td>${treatmentState(treatment)}</td>
        </tr>`,
          )
          .join('')}
      </table>
      <p>Ces traitements sont des réglages d'affichage ; ils n'ont pas modifié le fichier scellé ci-dessus.</p>`;
}

function sealParagraph(piece: ReportPieceIntegrityViewModel): string {
  if (piece.recordedSha256 === null) {
    return '<p class="alerte">Aucune empreinte n\'a été inscrite au registre lors du dépôt de cette pièce. Le présent rapport ne peut donc pas établir que le fichier est resté identique depuis sa réception.</p>';
  }
  const divergence = piece.divergesFromRecord
    ? '<p class="alerte">L\'empreinte figurant dans la fiche courante du dossier diffère de celle inscrite au registre lors du dépôt. C\'est la valeur du registre qui est imprimée ci-dessus et qui fait foi ; cette divergence doit être signalée au responsable du laboratoire.</p>'
    : '';
  const derived = piece.servedFileIsDerived
    ? "<p class=\"alerte\">L'image reproduite dans le présent rapport n'est pas le fichier reçu : le fichier reçu était au format TIFF, et une version PNG en a été établie par conversion sans perte pour permettre son affichage. L'empreinte imprimée ci-dessus est celle du fichier reçu, qui est conservé. L'empreinte de la version PNG n'a pas été inscrite au registre : le contrôle décrit ci-dessus ne peut donc pas être effectué sur l'image reproduite.</p>"
    : '';

  return `
      <p>Empreinte numérique du fichier reçu : <span class="hash">${escapeHtml(
        piece.recordedSha256,
      )}</span></p>
      <p>Mise sous scellé le ${formatDayTime(piece.sealedAt)}, inscription n° ${
        piece.recordEntryNumber
      } du registre.</p>
      ${divergence}
      ${derived}`;
}

function anchorParagraph(piece: ReportPieceIntegrityViewModel): string {
  if (piece.coveringAnchor === null) {
    return '';
  }
  return `<p>Horodatage par une autorité extérieure : le ${formatDayTime(
    piece.coveringAnchor.anchoredAt,
  )}, l'autorité d'horodatage ${escapeHtml(
    piece.coveringAnchor.authority,
  )} a daté un état du registre postérieur à ces opérations (inscription n° ${
    piece.coveringAnchor.entryNumber
  }). Cette date ne dépend pas de l'horloge du laboratoire.</p>`;
}

function controlParagraph(piece: ReportPieceIntegrityViewModel): string {
  if (piece.observedMatchesRecord === true) {
    return "<p>Contrôle effectué à l'édition du présent rapport : le fichier conservé porte bien l'empreinte inscrite au registre.</p>";
  }
  if (piece.observedMatchesRecord === false) {
    return "<p class=\"alerte\">Contrôle effectué à l'édition du présent rapport : le fichier conservé ne porte pas l'empreinte inscrite au registre lors du dépôt. Cette pièce doit être tenue pour altérée jusqu'à examen.</p>";
  }
  return '';
}

function pieceIntegrityBlock(piece: ReportPieceIntegrityViewModel): string {
  return `
    <div class="piece">
      <h3>${escapeHtml(piece.designation)} — cote ${escapeHtml(
        piece.cote ?? '/',
      )}</h3>
      ${sealParagraph(piece)}
      ${treatmentsBlock(piece)}
      ${anchorParagraph(piece)}
      ${controlParagraph(piece)}
    </div>`;
}

function integritySection(model: TechnicalReportViewModel): string {
  const { integrity } = model;
  const pieces = [...integrity.traces, ...integrity.referencePrints];

  return `
    ${integrityWarning(integrity)}
    ${INTEGRITY_PREAMBLE.map((paragraph) => `<p>${paragraph}</p>`).join('')}
    ${
      pieces.length === 0
        ? '<p class="empty">Aucune image n\'est versée à ce dossier.</p>'
        : pieces.map((piece) => pieceIntegrityBlock(piece)).join('')
    }
    <p>${INTEGRITY_SCOPE}</p>
    <p>Toute personne détenant l'un de ces fichiers peut contrôler elle-même, sans compte et sans solliciter le laboratoire, qu'il a bien été scellé et à quelle date : il suffit de le déposer sur ${escapeHtml(
      integrity.verificationUrl,
    )}. Lorsque le fichier déposé est un rapport, la page indique en outre si une version antérieure et si une version ultérieure de ce rapport ont été établies. Le calcul est effectué par le navigateur du lecteur, le fichier ne quitte pas son poste, et la page ne révèle ni le dossier, ni la procédure, ni l'identité des personnes concernées.</p>
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
        `la trace cotée ${quoted(identification.cote)}, identifiée ${identifiedAs(
          identification,
        )}`,
    )
    .join(', et ');

  return `
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

function summarySentence(summary: ReportJournalSummaryViewModel): string {
  const between = `entre ${formatHourMinute(summary.firstAt)} et ${formatHourMinute(
    summary.lastAt,
  )}`;
  const what =
    summary.family === 'ADJUSTMENT'
      ? `${summary.count} réglage${summary.count > 1 ? 's' : ''} d'amélioration d'image sur`
      : `${summary.count} minutie${summary.count > 1 ? 's' : ''} relevée${
          summary.count > 1 ? 's' : ''
        } sur`;
  return `${what} ${escapeHtml(summary.pieceDesignation)}, ${between}`;
}

function journalRow(row: JournalRow, order: number): string {
  const [at, author, sentence] =
    row.kind === 'act'
      ? [
          row.act.occurredAt,
          escapeHtml(row.act.actorDisplayName),
          escapeHtml(row.act.sentence),
        ]
      : [row.summary.lastAt, '—', summarySentence(row.summary)];

  return `
      <tr>
        <td class="numeric">${order}</td>
        <td>${formatDayTime(at)}</td>
        <td>${author}</td>
        <td>${sentence}</td>
      </tr>`;
}

function journalIntroduction(
  journal: ReportJournalViewModel,
  caseNumber: string,
): string {
  const always = `Chronologie des actes enregistrés sur le dossier ${escapeHtml(
    caseNumber,
  )}, dans l'ordre où ils ont été accomplis. Les dates et heures sont exprimées en temps universel (UTC). Les actes de saisie administrative — corrections d'en-tête, réglages du service — ne sont pas repris dans la présente chronologie.`;
  const variant =
    journal.detail === 'SUMMARY'
      ? 'Les réglages destinés à améliorer la lisibilité des images, qui peuvent être nombreux et repris plusieurs fois sur une même image, sont résumés par une ligne par trace. Une version détaillée de la présente annexe, qui les énumère un par un, peut être éditée sur demande.'
      : "Version détaillée : chaque réglage d'amélioration figure ci-dessous, un par un, sans regroupement.";
  return `<p>${always}</p><p>${variant}</p>`;
}

function journalIntegrityLine(integrity: ReportIntegrityViewModel): string {
  const verdict =
    integrity.firstBrokenEntryNumber === null
      ? "L'intégrité du registre a été vérifiée à l'édition du présent rapport : aucune anomalie relevée."
      : `L'intégrité du registre a été vérifiée à l'édition du présent rapport : une anomalie a été relevée à l'inscription n° ${integrity.firstBrokenEntryNumber}.`;
  const anchored =
    integrity.lastAnchor === null
      ? ''
      : ` Le dernier horodatage extérieur du registre date du ${formatDayTime(
          integrity.lastAnchor.anchoredAt,
        )}.`;
  return `<p class="note">${verdict}${anchored}</p>`;
}

function journalFoot(journal: ReportJournalViewModel): string {
  const total = `${journal.actCountTotal} inscription${
    journal.actCountTotal > 1 ? 's' : ''
  }`;
  const printed = `${journal.actCountPrinted} ligne${
    journal.actCountPrinted > 1 ? 's' : ''
  }`;
  return `<p class="note">Le registre de ce dossier porte ${total}, restituées ici en ${printed}.</p>`;
}

function journalSection(model: TechnicalReportViewModel): string {
  const { journal } = model;
  const rows = journalRows(journal);

  return `
    ${annexTitlePage('Annexe C — Journal des actes', model)}
    ${journalIntroduction(journal, model.caseHeader.caseNumber)}
    ${
      rows.length === 0
        ? '<p class="empty">Aucun acte enregistré sur ce dossier.</p>'
        : `<table>
            <tr><th>N°</th><th>Date et heure</th><th>Auteur</th><th>Acte</th></tr>
            ${rows.map((row, order) => journalRow(row, order + 1)).join('')}
          </table>`
    }
    ${journalFoot(journal)}
    ${journalIntegrityLine(model.integrity)}`;
}

function verificationActsTable(
  group: ReportVerificationActGroupViewModel,
): string {
  return `
    <h3>Actes sur ${escapeHtml(group.pieceDesignation)}</h3>
    <table>
      <tr><th>N°</th><th>Date et heure</th><th>Acte</th></tr>
      ${group.acts
        .map(
          (act) => `
      <tr>
        <td class="numeric">${act.order}</td>
        <td>${formatDayTime(act.occurredAt)}</td>
        <td>${escapeHtml(act.sentence)}</td>
      </tr>`,
        )
        .join('')}
    </table>`;
}

function verificationBlock(
  verification: ReportVerificationViewModel,
  order: number,
): string {
  const { verifier } = verification;
  const quality =
    verifier === null
      ? 'Compte supprimé du service'
      : `${escapeHtml(verifier.displayName)}, ${escapeHtml(
          verifier.grade,
        )}, matricule ${escapeHtml(verifier.serviceNumber)}`;

  return `
    <h3>Vérification ${order} — ${escapeHtml(verification.verdictLabel)}</h3>
    <p class="champ">Vérificateur : ${quality}</p>
    <p class="champ">Vérification confiée le ${formatDayTime(
      verification.requestedAt,
    )}, conclusions rendues le ${formatDayTime(verification.completedAt)}.</p>
    <table>
      <tr><th>Trace</th><th>Résultat de la confrontation</th></tr>
      ${verification.traces
        .map(
          (trace) => `
      <tr>
        <td>${escapeHtml(trace.traceDesignation)}</td>
        <td>${escapeHtml(trace.resultLabel)}</td>
      </tr>`,
        )
        .join('')}
    </table>
    ${
      verification.actGroups.length === 0
        ? '<p class="empty">Aucun acte du vérificateur sur les images.</p>'
        : verification.actGroups.map(verificationActsTable).join('')
    }`;
}

function verificationAnnexSection(model: TechnicalReportViewModel): string {
  if (model.verifications.length === 0) {
    return '';
  }

  return `
    ${annexTitlePage('Annexe D — Vérification par un second regard', model)}
    <p>Le dossier a été revérifié en aveugle : le vérificateur n'a eu accès ni aux réglages, ni aux repères, ni aux identifications, ni aux déclarations d'exploitabilité de l'opérateur du dossier. Les actes ci-dessous sont regroupés par pièce ; ils figurent aussi, dans la chronologie du dossier, à l'annexe C.</p>
    ${model.verifications
      .map((verification, order) => verificationBlock(verification, order + 1))
      .join('')}`;
}

function commissionParagraph(saisine: ReportSaisineViewModel): string {
  const magistrate = [saisine.magistrateName, saisine.magistrateTitle]
    .filter((part): part is string => part !== null && part.length > 0)
    .join(', ');
  const parts = [
    `Sur commission de ${escapeHtml(magistrate.length > 0 ? magistrate : 'la juridiction mandante')}, ${escapeHtml(saisine.courtReference)}`,
    saisine.ordinanceDate
      ? `par ordonnance du ${formatLongDay(saisine.ordinanceDate)}`
      : null,
    saisine.missionObject ? `pour ${escapeHtml(saisine.missionObject)}` : null,
    saisine.sealCount === null
      ? null
      : `portant sur ${saisine.sealCount} scellé${saisine.sealCount > 1 ? 's' : ''}`,
  ].filter((part): part is string => part !== null);
  return `<p>${parts.join(', ')}.</p>`;
}

function requisitionParagraph(): string {
  const requisition = `Les opérations ont été conduites à la demande du service requérant.`;
  const noOrdinance = `Ce dossier n'est pas placé sous expertise judiciaire : aucune ordonnance de commission d'expert n'y est attachée.`;
  return `<p>${requisition} ${noOrdinance}</p>`;
}

function assistantsParagraph(saisine: ReportSaisineViewModel): string {
  if (saisine.assistants.length === 0) return '';
  const named = saisine.assistants
    .map(
      (assistant) =>
        `${escapeHtml(assistant.name)} (${escapeHtml(assistant.task)})`,
    )
    .join(', ');
  return `<p>Ont assisté l'expert, sous son contrôle et sa responsabilité, pour la tâche indiquée : ${named}.</p>`;
}

function prorogationParagraph(saisine: ReportSaisineViewModel): string {
  if (
    saisine.prorogationDeadline === null &&
    saisine.prorogationOrdinanceDate === null
  ) {
    return '';
  }
  return `<p>Le délai de dépôt du rapport a été prorogé par ordonnance du ${formatLongDay(saisine.prorogationOrdinanceDate)}, au ${formatLongDay(saisine.prorogationDeadline)}.</p>`;
}

function biologicalPrecautionsParagraph(
  saisine: ReportSaisineViewModel,
): string {
  if (!saisine.biologicalPrecautions) return '';
  return `<p>Les opérations ont été conduites avec les précautions d'usage en vue d'analyses biologiques ultérieures.</p>`;
}

function oathBylineOf(saisine: ReportSaisineViewModel): string {
  const by = saisine.expert
    ? ` par ${escapeHtml(saisine.expert.displayName)}, ${escapeHtml(saisine.expert.grade)}`
    : '';
  return `Serment prêté le ${formatLongDay(saisine.swornAt)}${by}.`;
}

function factsSummary(description: string | null): string {
  return description === null || description.length === 0
    ? ''
    : `<h3>Résumé des faits</h3><p>${escapeHtml(description)}</p>`;
}

function saisineSection(model: TechnicalReportViewModel): string {
  const { saisine } = model;
  const facts = factsSummary(model.caseHeader.description);
  if (!saisine) {
    return `${requisitionParagraph()}${facts}`;
  }
  return `
    ${commissionParagraph(saisine)}
    <p>${escapeHtml(saisine.oathStatement)}</p>
    <p class="champ">${oathBylineOf(saisine)}</p>
    ${assistantsParagraph(saisine)}
    ${prorogationParagraph(saisine)}
    ${biologicalPrecautionsParagraph(saisine)}
    ${facts}`;
}

export function renderTechnicalReportHtml(
  model: TechnicalReportViewModel,
): string {
  const { caseHeader } = model;
  const sections = bodySections(model);
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
    <div class="garde">
      ${renderLetterhead(model.header.letterhead)}
      <h1>RAPPORT D'EXPLOITATION DE TRACES PAPILLAIRES</h1>
      <p class="subtitle">Examen dactyloscopique, comparaison et démonstration d'identité</p>

      ${referencesSection(model)}
      ${offenceSection(caseHeader)}
      ${recipientSection(caseHeader)}
    </div>

    <div class="sommaire">${summarySection(model, sections)}</div>

    ${renderBodySections(sections)}
    ${contributorsSentence(model.contributors)}
    ${signatureSection(model)}

    ${annexASection(model)}
    ${annexBSection(model)}

    ${journalSection(model)}

    ${verificationAnnexSection(model)}

    <div class="pied">${reportFooterText(model.header.reportNumber)}</div>
  </body>
</html>`;
}
