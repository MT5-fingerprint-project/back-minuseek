import {
  ReportPieceViewModel,
  TechnicalReportViewModel,
} from '../../../application/report-view-model';
import { escapeHtml, formatDate, formatJson } from '../html';
import { REPORT_STYLES } from './report-styles';

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
        <div><span class="fact-label">Statut</span> ${escapeHtml(piece.status ?? '—')}</div>
        <div><span class="fact-label">Score d'exploitabilité</span> ${escapeHtml(piece.exploitabilityScore ?? '—')}</div>
      </div>
      <p><span class="fact-label">Empreinte du fichier original</span><br />
        <span class="hash">${escapeHtml(piece.sha256 ?? 'non scellée (pièce déposée avant la mise sous scellé)')}</span>
      </p>
      ${
        piece.imageDataUrl
          ? `<img src="${piece.imageDataUrl}" alt="${escapeHtml(piece.label)}" />`
          : '<p class="missing-image">Image non embarquée : fichier illisible au moment du rendu.</p>'
      }
      ${layersTable(piece)}
    </div>`;
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

    <p class="seal">
      Rapport ${escapeHtml(header.reportId)}. Les calques sont décrits par leurs
      réglages : le rendu amélioré se rejoue dans le comparateur, à partir de ces
      valeurs. L'empreinte SHA-256 de ce document est enregistrée dans la chaîne
      d'audit du laboratoire (événement REPORT_GENERATED) au moment de son
      scellement ; elle n'est pas imprimable dans le document qu'elle scelle.
      ${
        header.chainHeadHash
          ? `Chaîne au maillon ${escapeHtml(header.chainHeadSeq)} : <span class="hash">${escapeHtml(header.chainHeadHash)}</span>.`
          : ''
      }
    </p>
  </body>
</html>`;
}
