import { Injectable, OnModuleDestroy } from '@nestjs/common';
import puppeteer, { type Browser } from 'puppeteer';
import type { ReportRendererPort } from '../../application/ports/report-renderer.port';
import { ReportViewModel } from '../../application/report-view-model';
import {
  renderTechnicalReportHtml,
  reportFooterText,
} from './templates/technical-report.template';
import { renderTraceabilityReportHtml } from './templates/traceability-report.template';

function toHtml(model: ReportViewModel): string {
  return model.kind === 'TECHNICAL'
    ? renderTechnicalReportHtml(model)
    : renderTraceabilityReportHtml(model);
}

function footerTemplate(reportNumber: string): string {
  return `
  <div style="width:100%; margin:0 16mm; padding-top:4px; border-top:1px solid #000;
              font-family:'Times New Roman', Georgia, serif; font-size:8pt;
              font-style:italic; text-align:center; color:#111;">
    ${reportFooterText(reportNumber)}
  </div>`;
}

@Injectable()
export class PuppeteerReportRenderer
  implements ReportRendererPort, OnModuleDestroy
{
  private browser: Browser | null = null;

  async render(model: ReportViewModel): Promise<Buffer> {
    const browser = await this.launchedBrowser();
    const page = await browser.newPage();
    try {
      await page.setContent(toHtml(model), { waitUntil: 'load' });
      const pdf = await page.pdf({
        format: 'A4',
        printBackground: true,
        preferCSSPageSize: true,
        displayHeaderFooter: true,
        headerTemplate: '<div></div>',
        footerTemplate: footerTemplate(model.header.reportNumber),
      });
      return Buffer.from(pdf);
    } finally {
      await page.close();
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.browser?.close();
    this.browser = null;
  }

  private async launchedBrowser(): Promise<Browser> {
    if (!this.browser?.connected) {
      this.browser = await puppeteer.launch({
        args: ['--no-sandbox', '--disable-dev-shm-usage'],
      });
    }
    return this.browser;
  }
}
