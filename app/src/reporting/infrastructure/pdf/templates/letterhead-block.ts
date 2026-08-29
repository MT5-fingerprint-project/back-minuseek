import { ReportLetterheadViewModel } from '../../../application/report-view-model';
import { escapeHtml } from '../html';

export function renderLetterhead(
  letterhead: ReportLetterheadViewModel | null,
): string {
  if (letterhead === null) {
    return '';
  }

  const contact = [letterhead.phoneNumber, letterhead.email]
    .filter((line): line is string => line !== null)
    .map(escapeHtml)
    .join(' — ');
  const lines = [letterhead.serviceName, letterhead.postalAddress]
    .filter((line): line is string => line !== null)
    .map(escapeHtml)
    .concat(contact.length === 0 ? [] : [contact]);

  return `
    <div class="lettre">
      ${
        letterhead.administration === null
          ? ''
          : `<b>${escapeHtml(letterhead.administration)}</b>`
      }
      ${lines.join('<br />')}
    </div>`;
}
