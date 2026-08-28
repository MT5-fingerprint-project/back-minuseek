import { ReportImageViewModel } from '../../../application/report-view-model';
import { escapeHtml } from '../html';

export interface PlateBlock {
  title: string;
  subtitle: string | null;
  image: ReportImageViewModel | null;
  cote: string | null;
  caption: string;
  legend: string | null;
}

const UNREADABLE =
  "L'image n'a pas pu être relue à l'édition du présent rapport.";

export function renderPlate(plate: PlateBlock): string {
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
          ? `<p class="empty">${UNREADABLE}</p>`
          : `<div class="planche-image">
          <img src="${plate.image.dataUrl}" alt="" />
          ${
            plate.cote === null
              ? ''
              : `<span class="planche-cote">${escapeHtml(plate.cote)}</span>`
          }
        </div>`
      }
      ${
        plate.legend === null
          ? ''
          : `<p class="planche-points">${escapeHtml(plate.legend)}</p>`
      }
      <p class="planche-legende">${escapeHtml(plate.caption)}</p>
    </section>`;
}
