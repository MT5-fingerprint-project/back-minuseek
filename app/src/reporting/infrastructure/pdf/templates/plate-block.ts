import {
  ReportDemonstrationMarkViewModel,
  ReportImageViewModel,
} from '../../../application/report-view-model';
import { escapeHtml } from '../html';

export interface PlateBlock {
  title: string;
  subtitle: string | null;
  image: ReportImageViewModel | null;
  marks: ReportDemonstrationMarkViewModel[];
  cote: string | null;
  caption: string;
}

const UNREADABLE =
  "L'image n'a pas pu être relue à l'édition du présent rapport.";
const NO_NATIVE_SIZE =
  "Les dimensions natives de cette image n'ont pas pu être lues : les minuties ne peuvent pas y être replacées.";

function plainImage(image: ReportImageViewModel): string {
  return `<img src="${image.dataUrl}" alt="" />`;
}

function markedImage(
  image: ReportImageViewModel,
  width: number,
  height: number,
  marks: ReportDemonstrationMarkViewModel[],
): string {
  const stroke = Math.max(2, Math.round(width / 400));
  const fontSize = Math.max(12, Math.round(width / 40));
  const markers = marks
    .map(
      (mark) => `
        <circle cx="${mark.x}" cy="${mark.y}" r="${mark.radius}"
                fill="none" stroke="#d92b2b" stroke-width="${stroke}" />
        <text x="${mark.x + mark.radius + stroke}" y="${mark.y - mark.radius}"
              font-size="${fontSize}" fill="#d92b2b" font-weight="bold">${mark.number}</text>`,
    )
    .join('');

  return `<svg viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
      <image href="${image.dataUrl}" x="0" y="0" width="${width}" height="${height}" />
      ${markers}
    </svg>`;
}

function pointNames(marks: ReportDemonstrationMarkViewModel[]): string | null {
  const named = marks.filter((mark) => mark.label !== null);
  if (named.length === 0) {
    return null;
  }
  return named
    .map((mark) => `${mark.number} — ${escapeHtml(mark.label as string)}`)
    .join(', ');
}

function plateBody(plate: PlateBlock): string {
  if (plate.image === null) {
    return `<p class="empty">${UNREADABLE}</p>`;
  }
  const { width, height } = plate.image;
  if (plate.marks.length === 0) {
    return plainImage(plate.image);
  }
  if (width === null || height === null) {
    return `${plainImage(plate.image)}<p class="empty">${NO_NATIVE_SIZE}</p>`;
  }
  return markedImage(plate.image, width, height, plate.marks);
}

export function renderPlate(plate: PlateBlock): string {
  const names = pointNames(plate.marks);
  return `
    <section class="planche">
      <h3>${escapeHtml(plate.title)}</h3>
      ${
        plate.subtitle === null
          ? ''
          : `<p class="planche-sous">${escapeHtml(plate.subtitle)}</p>`
      }
      ${
        plate.image === null
          ? plateBody(plate)
          : `<div class="planche-image">
          ${plateBody(plate)}
          ${
            plate.cote === null
              ? ''
              : `<span class="planche-cote">${escapeHtml(plate.cote)}</span>`
          }
        </div>`
      }
      ${names === null ? '' : `<p class="planche-points">${names}</p>`}
      <p class="planche-legende">${escapeHtml(plate.caption)}</p>
    </section>`;
}
