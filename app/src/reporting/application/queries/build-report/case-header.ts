import {
  CaseReportData,
  SubjectData,
} from '../../ports/case-report-data.reader';
import {
  ReportCaseHeaderViewModel,
  ReportRecipientViewModel,
} from '../../report-view-model';
import { formatDay } from '../../report-dates';
import { civilityLabel } from './action-labels';
import { surname } from './trace-verdicts';

function victimSentence(subject: SubjectData): string {
  const identity = `${civilityLabel(subject.sex)} ${surname(subject)}`;
  if (subject.birthDate === null) {
    return identity;
  }
  const born = subject.sex === 'FEMALE' ? 'née le' : 'né le';
  return `${identity}, ${born} ${formatDay(subject.birthDate)}`;
}

function buildRecipient(data: CaseReportData): ReportRecipientViewModel | null {
  const { authority, attentionQuality, attentionName } =
    data.investigationCase.recipient;
  if (authority === null) {
    return null;
  }
  const attention = [attentionQuality, attentionName]
    .filter((part): part is string => part !== null && part.length > 0)
    .join(' ');
  return { authority, attention: attention.length > 0 ? attention : null };
}

export function buildCaseHeader(
  data: CaseReportData,
): ReportCaseHeaderViewModel {
  const investigationCase = data.investigationCase;
  return {
    caseNumber: investigationCase.caseNumber,
    pvNumber: investigationCase.pvNumber,
    requestDate: investigationCase.requestDate,
    requesterQuality: investigationCase.requesterQuality,
    requesterName: investigationCase.requesterName,
    requesterService: investigationCase.requesterService,
    offenseNature: investigationCase.offenseNature,
    offenseLocation: investigationCase.offenseLocation,
    offenseDateFrom: investigationCase.offenseDateFrom,
    offenseDateTo: investigationCase.offenseDateTo,
    interventionDate: investigationCase.interventionDate,
    caseAgainst: investigationCase.caseAgainst,
    victims: data.subjects
      .filter((subject) => subject.type === 'VICTIM')
      .map(victimSentence),
    recipient: buildRecipient(data),
  };
}
