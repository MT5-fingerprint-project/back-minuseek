import { ReportTypeName } from '../../../domain/report/entity/report';

export interface CaseReportReadModel {
  id: string;
  type: ReportTypeName;
  sha256: string;
  createdAt: Date;
  generatedByDisplayName: string;
}
