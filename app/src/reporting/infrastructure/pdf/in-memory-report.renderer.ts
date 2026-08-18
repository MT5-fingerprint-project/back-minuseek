import type { ReportRendererPort } from '../../application/ports/report-renderer.port';
import { ReportViewModel } from '../../application/report-view-model';

export class InMemoryReportRenderer implements ReportRendererPort {
  readonly rendered: ReportViewModel[] = [];

  render(model: ReportViewModel): Promise<Buffer> {
    this.rendered.push(model);
    return Promise.resolve(Buffer.from(`pdf:${model.kind}`));
  }
}
