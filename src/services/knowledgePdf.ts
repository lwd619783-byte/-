import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import type { SourceSegment } from '../types/knowledgeIngestion';

GlobalWorkerOptions.workerSrc = workerUrl;
/** Text extraction only: no renderer, document JS, OCR, URL fetch or external font assets. */
export async function extractPdfPages(bytes: Uint8Array): Promise<SourceSegment[]> {
  const task = getDocument({ data: new Uint8Array(bytes), useSystemFonts: false, disableFontFace: true, stopAtErrors: true, useWorkerFetch: false });
  task.onPassword = () => { void task.destroy(); };
  try {
    const document = await task.promise;
    if (document.numPages > 500) throw new Error('PDF 超过 500 页解析上限');
    const pages: SourceSegment[] = [];
    for (let number = 1; number <= document.numPages; number++) {
      const page = await document.getPage(number), content = await page.getTextContent();
      pages.push({ locator: `page:${number}`, label: `第 ${number} 页`, text: content.items.map(item => 'str' in item ? item.str + (item.hasEOL ? '\n' : ' ') : '').join('').trim() }); page.cleanup();
    }
    return pages;
  } finally { await task.destroy(); }
}
