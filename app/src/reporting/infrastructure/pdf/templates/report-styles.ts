/** Charte commune aux deux rapports : en-tête, pied de page, tableaux. */
export const REPORT_STYLES = `
  @page { size: A4; margin: 18mm 16mm; }
  * { box-sizing: border-box; }
  body {
    font-family: "Helvetica Neue", Helvetica, Arial, sans-serif;
    font-size: 10pt;
    color: #10151f;
    margin: 0;
  }
  h1 { font-size: 18pt; margin: 0 0 2mm; }
  h2 { font-size: 12pt; margin: 8mm 0 3mm; border-bottom: 0.4mm solid #10151f; padding-bottom: 1mm; }
  h3 { font-size: 10.5pt; margin: 5mm 0 2mm; }
  .subtitle { color: #55606f; margin: 0 0 6mm; }
  .facts { display: grid; grid-template-columns: repeat(2, 1fr); gap: 1.5mm 6mm; margin-bottom: 4mm; }
  .fact-label { color: #55606f; }
  table { width: 100%; border-collapse: collapse; margin: 2mm 0 4mm; }
  th, td { border: 0.2mm solid #c3cad6; padding: 1.4mm 2mm; text-align: left; vertical-align: top; }
  th { background: #eef1f6; font-weight: 600; }
  td.numeric { text-align: right; font-variant-numeric: tabular-nums; }
  .hash { font-family: "SFMono-Regular", Consolas, monospace; font-size: 7.5pt; word-break: break-all; }
  pre { font-family: "SFMono-Regular", Consolas, monospace; font-size: 7.5pt; margin: 0; white-space: pre-wrap; }
  .piece { page-break-inside: avoid; margin-bottom: 6mm; }
  .piece img { max-width: 80mm; max-height: 80mm; border: 0.2mm solid #c3cad6; }
  .missing-image { color: #55606f; font-style: italic; }
  .seal { margin-top: 8mm; border-top: 0.4mm solid #10151f; padding-top: 2mm; font-size: 8pt; color: #55606f; }
  .empty { color: #55606f; font-style: italic; }
`;
