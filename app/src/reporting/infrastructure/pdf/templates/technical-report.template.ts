import {
  ReportIdentityDemonstrationViewModel,
  ReportJournalEntryViewModel,
  ReportPieceViewModel,
  TechnicalReportViewModel,
} from '../../../application/report-view-model';
import { escapeHtml, formatDate, formatDay, formatJson } from '../html';
import { REPORT_STYLES } from './report-styles';

const MARKER_RADIUS_RATIO = 110;
const LABEL_OFFSET_RATIO = 1.9;

/**
 * Planche d'une pièce : l'image dans son repère pixel natif, les minuties
 * replacées à leurs coordonnées et numérotées. Sans dimensions natives (format
 * non lu, TIFF par exemple), les marqueurs ne peuvent pas être replacés — on
 * l'écrit plutôt que de dessiner à côté.
 */
function markedImage(piece: ReportPieceViewModel): string {
  if (piece.withdrawal) {
    return `<p class="missing-image">Retirée du dossier le ${formatDay(
      piece.withdrawal.at,
    )} — ${escapeHtml(piece.withdrawal.motiveLabel)}.</p>`;
  }
  if (!piece.image) {
    return '<p class="missing-image">Image non embarquée : fichier illisible au moment du rendu.</p>';
  }
  const { dataUrl, width, height } = piece.image;
  if (width === null || height === null) {
    return `
      <img src="${dataUrl}" alt="${escapeHtml(piece.label)}" />
      ${
        piece.minutiae.length > 0
          ? '<p class="missing-image">Minuties non replacées : dimensions natives illisibles dans ce format.</p>'
          : ''
      }`;
  }

  const markerRadius = Math.max(width, height) / MARKER_RADIUS_RATIO;
  const stroke = markerRadius / 4;
  const markers = piece.minutiae
    .map((minutia) => {
      const radius = Math.max(minutia.radius, markerRadius);
      const direction =
        minutia.angleDeg === null
          ? ''
          : (() => {
              const radians = (minutia.angleDeg * Math.PI) / 180;
              return `<line x1="${minutia.x}" y1="${minutia.y}" x2="${
                minutia.x + Math.cos(radians) * radius * 2.4
              }" y2="${
                minutia.y + Math.sin(radians) * radius * 2.4
              }" stroke="${minutia.color}" stroke-width="${stroke}" />`;
            })();
      return `
        <g>
          <circle cx="${minutia.x}" cy="${minutia.y}" r="${radius}" fill="none" stroke="${minutia.color}" stroke-width="${stroke}" />
          ${direction}
          <text x="${minutia.x + radius * LABEL_OFFSET_RATIO}" y="${
            minutia.y - radius * 0.8
          }" font-size="${radius * 2.2}" fill="${minutia.color}" stroke="#ffffff" stroke-width="${
            stroke / 2
          }" paint-order="stroke">${minutia.index}</text>
        </g>`;
    })
    .join('');

  return `
    <svg class="planche" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
      <image href="${dataUrl}" x="0" y="0" width="${width}" height="${height}" />
      ${markers}
    </svg>`;
}

function minutiaeTable(piece: ReportPieceViewModel): string {
  if (piece.minutiae.length === 0) {
    return '<p class="empty">Aucune minutie relevée.</p>';
  }
  return `
    <table>
      <thead>
        <tr><th>N°</th><th>x</th><th>y</th><th>Direction</th></tr>
      </thead>
      <tbody>
        ${piece.minutiae
          .map(
            (minutia) => `
          <tr>
            <td class="numeric">${minutia.index}</td>
            <td class="numeric">${Math.round(minutia.x)}</td>
            <td class="numeric">${Math.round(minutia.y)}</td>
            <td class="numeric">${
              minutia.angleDeg === null
                ? '—'
                : `${Math.round(minutia.angleDeg)}°`
            }</td>
          </tr>`,
          )
          .join('')}
      </tbody>
    </table>`;
}

function layersTable(piece: ReportPieceViewModel): string {
  if (piece.layers.length === 0) {
    return '<p class="empty">Aucun calque d\'amélioration.</p>';
  }
  return `
    <table>
      <thead>
        <tr><th>Calque</th><th>Type</th><th>Ordre</th><th>Visible</th><th>Réglages</th></tr>
      </thead>
      <tbody>
        ${piece.layers
          .map(
            (layer) => `
          <tr>
            <td>${escapeHtml(layer.name)}</td>
            <td>${escapeHtml(layer.type)}</td>
            <td class="numeric">${escapeHtml(layer.zIndex)}</td>
            <td>${layer.isVisible ? 'oui' : 'non'}</td>
            <td><pre>${formatJson(layer.settings)}</pre></td>
          </tr>`,
          )
          .join('')}
      </tbody>
    </table>`;
}

function pieceSection(piece: ReportPieceViewModel): string {
  return `
    <div class="piece">
      <h3>${escapeHtml(piece.label)}</h3>
      <div class="facts">
        <div><span class="fact-label">Reçue le</span> ${formatDate(piece.receivedAt)}</div>
        <div><span class="fact-label">Prise de vue</span> ${formatDate(piece.capturedAt)}</div>
        ${
          piece.withdrawal
            ? `<div><span class="fact-label">Retirée du dossier</span> ${formatDay(
                piece.withdrawal.at,
              )} — ${escapeHtml(piece.withdrawal.motiveLabel)}</div>`
            : `<div><span class="fact-label">Statut</span> ${escapeHtml(piece.status ?? '—')}</div>
        <div><span class="fact-label">Score d'exploitabilité</span> ${escapeHtml(piece.exploitabilityScore ?? '—')}</div>`
        }
      </div>
      <p><span class="fact-label">Empreinte du fichier original</span><br />
        <span class="hash">${escapeHtml(piece.sha256 ?? 'non scellée (pièce déposée avant la mise sous scellé)')}</span>
      </p>
      <div class="piece-image">${markedImage(piece)}</div>
      ${layersTable(piece)}
    </div>`;
}

function conclusion(
  demonstration: ReportIdentityDemonstrationViewModel,
): string {
  const { subject, position, score, declaredBy } = demonstration;
  const who = subject
    ? `${escapeHtml(subject.lastName.toUpperCase())} ${escapeHtml(subject.firstName)}, né(e) le ${formatDay(
        subject.birthDate,
      )} à ${escapeHtml(subject.birthPlace)}`
    : 'un sujet non renseigné dans le dossier';
  const zone = position
    ? `au ${escapeHtml(position)}`
    : 'à une zone non précisée';
  const expert = declaredBy
    ? `${escapeHtml(declaredBy.grade)} ${escapeHtml(declaredBy.displayName)} (matricule ${escapeHtml(
        declaredBy.serviceNumber,
      )})`
    : 'un utilisateur non identifié';

  return `
    <p>
      La trace <strong>${escapeHtml(demonstration.trace.label)}</strong> est déclarée en
      correspondance avec l'empreinte de référence
      <strong>${escapeHtml(demonstration.referencePrint.label)}</strong>, attribuée ${zone}
      de ${who}. Déclaration faite le ${formatDate(demonstration.declaredAt)} par ${expert}.
      ${
        score === null
          ? "Aucun score de comparaison n'est enregistré pour ce couple."
          : `Score de comparaison : <strong>${escapeHtml(score)}</strong>${
              demonstration.machineMatch === null
                ? ''
                : ` (verdict du moteur : ${
                    demonstration.machineMatch
                      ? 'correspondance'
                      : 'pas de correspondance'
                  })`
            }.`
      }
      Le score est un élément d'appui : la correspondance ci-dessous est un acte d'expert,
      appuyé sur ${demonstration.trace.minutiae.length} minuties relevées sur la trace et
      ${demonstration.referencePrint.minutiae.length} sur l'empreinte de référence, la
      plateforme exigeant au minimum ${demonstration.requiredMinutiae} points de part et
      d'autre pour accepter la déclaration.
    </p>`;
}

function demonstrationSection(
  demonstration: ReportIdentityDemonstrationViewModel,
  order: number,
): string {
  return `
    <div class="demonstration">
      <h3>Planche n°${order} — ${escapeHtml(demonstration.trace.label)} / ${escapeHtml(
        demonstration.referencePrint.label,
      )}</h3>
      ${conclusion(demonstration)}
      <div class="planche-pair">
        <div>
          <h4>Trace ${escapeHtml(demonstration.trace.label)}</h4>
          ${markedImage(demonstration.trace)}
          <p class="hash">${escapeHtml(demonstration.trace.sha256 ?? 'pièce non scellée')}</p>
        </div>
        <div>
          <h4>Référence ${escapeHtml(demonstration.referencePrint.label)}</h4>
          ${markedImage(demonstration.referencePrint)}
          <p class="hash">${escapeHtml(
            demonstration.referencePrint.sha256 ?? 'pièce non scellée',
          )}</p>
        </div>
      </div>
      <p class="caption">
        Les cercles marquent les minuties relevées par l'expert, à leurs coordonnées dans
        l'image d'origine ; le trait indique la direction du flux quand elle a été saisie.
        Le diamètre des marqueurs est une convention d'affichage, leur position ne l'est pas.
        La numérotation suit l'ordre de saisie de chaque pièce et ne préjuge d'aucune mise en
        correspondance point par point.
      </p>
      <div class="planche-pair">
        <div>${minutiaeTable(demonstration.trace)}</div>
        <div>${minutiaeTable(demonstration.referencePrint)}</div>
      </div>
      <h4>Traitements appliqués, pour rejouer la comparaison</h4>
      <div class="planche-pair">
        <div>${layersTable(demonstration.trace)}</div>
        <div>${layersTable(demonstration.referencePrint)}</div>
      </div>
    </div>`;
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
    <h2>Journal des actes (${journal.chained.length})</h2>
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
            <thead>
              <tr><th>Maillon</th><th>Acte</th><th>Auteur</th><th>Horodatage serveur (UTC)</th><th>Détail</th><th>Empreinte (début)</th></tr>
            </thead>
            <tbody>${journalRows(journal.chained)}</tbody>
          </table>`
    }`;
}

function comparisonsTable(model: TechnicalReportViewModel): string {
  if (model.comparisons.length === 0) {
    return '<p class="empty">Aucune comparaison enregistrée.</p>';
  }
  return `
    <table>
      <thead>
        <tr><th>Trace</th><th>Empreinte de référence</th><th>Score</th><th>Verdict moteur</th><th>Correspondance déclarée</th><th>Comparée le</th></tr>
      </thead>
      <tbody>
        ${model.comparisons
          .map(
            (comparison) => `
          <tr>
            <td>${escapeHtml(comparison.traceLabel)}</td>
            <td>${escapeHtml(comparison.referencePrintLabel)}</td>
            <td class="numeric">${escapeHtml(comparison.score)}</td>
            <td>${comparison.machineMatch ? 'correspondance' : 'pas de correspondance'}</td>
            <td>${comparison.declaredHit ? 'oui, par un expert' : 'non'}</td>
            <td>${formatDate(comparison.comparedAt)}</td>
          </tr>`,
          )
          .join('')}
      </tbody>
    </table>`;
}

export function renderTechnicalReportHtml(
  model: TechnicalReportViewModel,
): string {
  const { header } = model;
  return `<!DOCTYPE html>
<html lang="fr">
  <head>
    <meta charset="utf-8" />
    <title>Rapport technique — dossier ${escapeHtml(header.caseNumber)}</title>
    <style>${REPORT_STYLES}</style>
  </head>
  <body>
    <h1>Rapport technique</h1>
    <p class="subtitle">Dossier ${escapeHtml(header.caseNumber)} — procès-verbal ${escapeHtml(header.pvNumber)}</p>

    <div class="facts">
      <div><span class="fact-label">Statut du dossier</span> ${escapeHtml(header.caseStatus)}</div>
      <div><span class="fact-label">Ouvert le</span> ${formatDate(header.openedAt)}</div>
      <div><span class="fact-label">Édité le</span> ${formatDate(header.generatedAt)}</div>
      <div><span class="fact-label">Édité par</span> ${escapeHtml(header.generatedByDisplayName)}</div>
    </div>

    ${
      model.caseDescription
        ? `<h2>Contexte</h2><p>${escapeHtml(model.caseDescription)}</p>`
        : ''
    }

    <h2>Démonstration d'identité (${model.identityDemonstrations.length})</h2>
    ${
      model.identityDemonstrations.length === 0
        ? `<p class="empty">Aucune correspondance déclarée sur ce dossier : le rapport ne
             conclut à aucune identité.</p>`
        : model.identityDemonstrations
            .map((demonstration, order) =>
              demonstrationSection(demonstration, order + 1),
            )
            .join('')
    }

    <h2>Traces (${model.traces.length})</h2>
    ${
      model.traces.length === 0
        ? '<p class="empty">Aucune trace déposée.</p>'
        : model.traces.map(pieceSection).join('')
    }

    <h2>Empreintes de référence (${model.referencePrints.length})</h2>
    ${
      model.referencePrints.length === 0
        ? '<p class="empty">Aucune empreinte de référence déposée.</p>'
        : model.referencePrints.map(pieceSection).join('')
    }

    <h2>Comparaisons</h2>
    ${comparisonsTable(model)}

    ${journalSection(model)}

    <p class="seal">
      Rapport ${escapeHtml(header.reportId)}. Les calques sont décrits par leurs réglages : le
      rendu amélioré se rejoue dans le comparateur à partir de ces valeurs. L'empreinte
      SHA-256 de ce document est enregistrée dans la chaîne d'audit du laboratoire (événement
      REPORT_GENERATED) au moment de son scellement ; elle n'est pas imprimable dans le
      document qu'elle scelle.
      ${
        header.chainHeadHash
          ? `Chaîne au maillon ${escapeHtml(header.chainHeadSeq)} : <span class="hash">${escapeHtml(header.chainHeadHash)}</span>.`
          : ''
      }
    </p>
  </body>
</html>`;
}
