import { TraceabilityReportViewModel } from '../../../application/report-view-model';
import { formatDate } from '../../../application/report-dates';
import { escapeHtml, formatJson } from '../html';
import { renderLetterhead } from './letterhead-block';
import { REPORT_STYLES } from './report-styles';

function attestationBlock(model: TraceabilityReportViewModel): string {
  const { attestation } = model;
  const verdict = attestation.ok
    ? "La chaîne d'audit du laboratoire a été recalculée intégralement : aucune rupture détectée."
    : `Rupture détectée${
        attestation.firstBrokenSeq === null
          ? ''
          : ` au maillon ${escapeHtml(attestation.firstBrokenSeq)}`
      }. Ce rapport ne vaut pas attestation d'intégrité.`;

  return `
    <p>${verdict}</p>
    <div class="facts">
      <div><span class="fact-label">Maillons recalculés</span> ${escapeHtml(attestation.eventsChecked)}</div>
      <div><span class="fact-label">Ancres validées</span> ${escapeHtml(attestation.anchorsVerified)}</div>
      <div><span class="fact-label">Ancres en échec</span> ${escapeHtml(attestation.anchorsFailed)}</div>
      <div><span class="fact-label">Édité le</span> ${formatDate(model.header.generatedAt)}</div>
    </div>`;
}

function eventsTable(model: TraceabilityReportViewModel): string {
  if (model.events.length === 0) {
    return '<p class="empty">Aucun événement chaîné pour ce dossier.</p>';
  }
  return `
    <table>
      <thead>
        <tr><th>Seq</th><th>Acte</th><th>Classe</th><th>Acteur</th><th>Horodatage serveur (UTC)</th><th>Détail</th><th>Empreinte du maillon</th></tr>
      </thead>
      <tbody>
        ${model.events
          .map(
            (event) => `
          <tr>
            <td class="numeric">${escapeHtml(event.seq)}</td>
            <td>${escapeHtml(event.eventType)}</td>
            <td>${event.evidenceClass === 'OBSERVED' ? 'observé' : 'déclaré'}</td>
            <td>${escapeHtml(event.actorDisplayName)}</td>
            <td>${formatDate(event.occurredAt)}</td>
            <td><pre>${formatJson(event.payload)}</pre></td>
            <td class="hash">${escapeHtml(event.hash)}</td>
          </tr>`,
          )
          .join('')}
      </tbody>
    </table>`;
}

function anchorsTable(model: TraceabilityReportViewModel): string {
  if (model.anchors.length === 0) {
    return `<p class="empty">Aucune ancre : l'existence des maillons n'est pas encore
      datée par un tiers. Tout ce qui précède la première ancre garde une preuve
      d'existence sans datation opposable.</p>`;
  }
  return `
    <table>
      <thead>
        <tr><th>Maillon ancré</th><th>Empreinte ancrée</th><th>Autorité</th><th>Horodatage TSA (UTC)</th><th>Empreinte du jeton</th></tr>
      </thead>
      <tbody>
        ${model.anchors
          .map(
            (anchor) => `
          <tr>
            <td class="numeric">${escapeHtml(anchor.headSeq)}</td>
            <td class="hash">${escapeHtml(anchor.headHash)}</td>
            <td>${escapeHtml(anchor.tsaUrl)}</td>
            <td>${formatDate(anchor.anchoredAt)}</td>
            <td class="hash">${escapeHtml(anchor.tsrSha256)}</td>
          </tr>`,
          )
          .join('')}
      </tbody>
    </table>`;
}

function hashSpineBlock(model: TraceabilityReportViewModel): string {
  const spine = model.hashSpine
    .map((link) => `${link.seq} ${link.hash}`)
    .join('\n');
  return `
    <p>Suite complète des maillons du laboratoire, du genesis à la tête. Les
      maillons étrangers à ce dossier n'exposent que leur numéro et leur
      empreinte : un condensat ne dit rien du dossier voisin. Cette suite permet
      de recalculer la continuité <code>prevHash</code> de l'extrait ci-dessus
      sans accès à la base.</p>
    <pre>${escapeHtml(spine)}</pre>`;
}

export function renderTraceabilityReportHtml(
  model: TraceabilityReportViewModel,
): string {
  const { header } = model;
  return `<!DOCTYPE html>
<html lang="fr">
  <head>
    <meta charset="utf-8" />
    <title>Annexe de traçabilité — dossier ${escapeHtml(header.caseNumber)}</title>
    <style>${REPORT_STYLES}</style>
  </head>
  <body>
    ${renderLetterhead(header.letterhead)}
    <h1>Annexe de traçabilité</h1>
    <p class="subtitle">Dossier ${escapeHtml(header.caseNumber)} — procès-verbal ${escapeHtml(header.pvNumber)}</p>

    <h2>Attestation d'intégrité</h2>
    ${attestationBlock(model)}

    <h2>Chronologie des actes (${model.events.length})</h2>
    ${eventsTable(model)}

    <h2>Ancrages temporels</h2>
    ${anchorsTable(model)}

    <h2>Épine de hashes</h2>
    ${hashSpineBlock(model)}

    <p class="seal">
      Annexe ${escapeHtml(header.reportNumber)}, éditée par ${escapeHtml(header.generatedByDisplayName)}.
      L'empreinte SHA-256 de ce document est scellée dans la chaîne au moment de
      sa génération (événement REPORT_GENERATED) : elle ne peut pas figurer dans
      le document qu'elle scelle.
      ${
        header.chainHeadHash
          ? `Chaîne au maillon ${escapeHtml(header.chainHeadSeq)} : <span class="hash">${escapeHtml(header.chainHeadHash)}</span>.`
          : ''
      }
    </p>
  </body>
</html>`;
}
