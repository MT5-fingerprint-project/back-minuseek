import { ServiceLetterheadData } from '../../ports/service-letterhead.reader';
import { ReportLetterheadViewModel } from '../../report-view-model';

function filled(value: string): string | null {
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}

export function buildLetterhead(
  settings: ServiceLetterheadData,
): ReportLetterheadViewModel | null {
  const letterhead = {
    administration: filled(settings.administration),
    serviceName: filled(settings.serviceName),
    postalAddress: filled(settings.postalAddress),
    phoneNumber: filled(settings.phoneNumber),
    email: filled(settings.email),
  };
  const empty = Object.values(letterhead).every((line) => line === null);
  return empty ? null : letterhead;
}

export function signatureCityOf(
  settings: ServiceLetterheadData,
): string | null {
  return filled(settings.signatureCity);
}
