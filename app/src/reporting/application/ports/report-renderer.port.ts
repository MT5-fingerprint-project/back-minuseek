import { ReportViewModel } from '../report-view-model';

export interface ReportRendererPort {
  render(model: ReportViewModel): Promise<Buffer>;
}

export const REPORT_RENDERER = 'ReportRenderer';
