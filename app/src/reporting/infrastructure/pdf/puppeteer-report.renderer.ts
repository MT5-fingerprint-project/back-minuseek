import { Injectable, OnModuleDestroy } from '@nestjs/common';
import puppeteer, { type Browser } from 'puppeteer';
import type { ReportRendererPort } from '../../application/ports/report-renderer.port';
import { ReportViewModel } from '../../application/report-view-model';
import { renderTechnicalReportHtml } from './templates/technical-report.template';
import { renderTraceabilityReportHtml } from './templates/traceability-report.template';

function toHtml(model: ReportViewModel): string {
  return model.kind === 'TECHNICAL'
    ? renderTechnicalReportHtml(model)
    : renderTraceabilityReportHtml(model);
}

/**
 * Un seul navigateur pour tout le process : sur Cloud Run scale-to-zero, un
 * lancement de Chromium par rapport doublerait le temps de génération.
 */
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
