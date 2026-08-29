export const REPORT_STYLES = `
  @page { size: A4; margin: 18mm 16mm 26mm; }
  * { box-sizing: border-box; }
  body {
    font-family: "Times New Roman", Georgia, serif;
    font-size: 10.5pt;
    line-height: 1.45;
    color: #111;
    margin: 0;
  }
  .lettre {
    text-align: center; font-family: Arial, Helvetica, sans-serif; font-size: 8pt;
    line-height: 1.3; letter-spacing: .04em;
    border-bottom: 1px solid #000; padding-bottom: 6px; margin-bottom: 14px;
  }
  .lettre b { display: block; font-size: 9pt; }
  h1 { font-size: 14pt; text-align: center; margin: 18px 0 2px; letter-spacing: .04em; font-weight: bold; }
  h2 { font-size: 11pt; margin: 20px 0 6px; text-transform: uppercase; letter-spacing: .03em; break-after: avoid; }
  h3 { font-size: 10.5pt; margin: 14px 0 4px; font-weight: bold; break-after: avoid; }
  p { margin: 0 0 6px; }
  .subtitle { text-align: center; font-size: 10pt; font-style: italic; margin: 0 0 20px; }
  .champ { margin: 0 0 3px; }
  .champ .k { font-variant: small-caps; letter-spacing: .04em; }
  .duo { display: flex; gap: 10mm; }
  .duo > div { flex: 1; }
  table { width: 100%; border-collapse: collapse; margin: 8px 0 12px; font-size: 9pt; }
  tr { break-inside: avoid; }
  th, td { border: 1px solid #444; padding: 3px 5px; text-align: left; vertical-align: top; }
  th { background: #f0f0ee; font-weight: bold; font-size: 8.5pt; text-transform: uppercase; }
  td.numeric { text-align: right; font-variant-numeric: tabular-nums; }
  ul.rec { margin: 4px 0 10px; padding-left: 6mm; }
  ul.rec li { margin-bottom: 3px; }
  .note { font-size: 8.5pt; }
  .empty { font-style: italic; }
  section { page-break-inside: auto; }

  /* À l'écran le pied clôt le document ; à l'impression c'est Chromium qui le
     répète dans la marge basse, un élément fixé chevauchant le texte. */
  .pied {
    border-top: 1px solid #000;
    margin-top: 22px;
    padding-top: 4px;
    font-size: 8pt;
    font-style: italic;
    text-align: center;
  }
  @media print {
    .pied { display: none; }
  }
    
  .sign { margin-top: 12mm; text-align: right; break-inside: avoid; }
  .sign .vide { height: 18mm; }

     mention dégradée se voit sans être lue. */
  .piece { break-inside: avoid; margin-bottom: 5mm; }
  .alerte {
    border: 0.4mm solid #111; padding: 2mm 3mm; margin: 3px 0 6px;
    background: #f4f2ee;
  }

  /* Annexe de traçabilité : document technique, pas pièce de procédure. */
  .facts { display: grid; grid-template-columns: repeat(2, 1fr); gap: 1.5mm 6mm; margin-bottom: 4mm; }
  .fact-label { color: #55606f; }
  .hash { font-family: "SFMono-Regular", Consolas, monospace; font-size: 7.5pt; word-break: break-all; }
  pre { font-family: "SFMono-Regular", Consolas, monospace; font-size: 7.5pt; margin: 0; white-space: pre-wrap; }
  .seal { margin-top: 8mm; border-top: 0.4mm solid #111; padding-top: 2mm; font-size: 8pt; color: #55606f; }
`;
