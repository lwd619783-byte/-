import { JSDOM } from 'jsdom';

const requireThat = (ok, code) => { if (!ok) throw new Error(code); };
const clean = value => value.replace(/\s+/gu, ' ').trim();
/** Inert official history HTML; no scripts/resources/network. No imputation or vintage inference. */
export function parseEiaPetroleum(html, source, window) {
  const dom = new JSDOM(html);
  try {
    const d = dom.window.document;
    requireThat(clean(d.title) === source.title, 'EIA_SERIES_TITLE');
    const downloads = [...d.querySelectorAll('a')].filter(a => clean(a.textContent) === 'Download Data (XLS File)');
    requireThat(downloads.length === 1 && new URL(downloads[0].getAttribute('href'), source.url).href === source.downloadUrl, 'EIA_SERIES_DOWNLOAD');
    const tables = [...d.querySelectorAll('table.FloatTitle')];
    requireThat(tables.length === 1, 'EIA_HISTORY_TABLE');
    const rows = [...tables[0].querySelectorAll('tr')];
    requireThat(clean(rows[0].textContent) === 'Year-Month Week 1 Week 2 Week 3 Week 4 Week 5'
      && clean(rows[1].textContent) === 'End Date Value End Date Value End Date Value End Date Value End Date Value', 'EIA_WEEKLY_HEADER');
    const releaseDates = [...d.querySelectorAll('td.F2')].map(c => clean(c.textContent)).filter(t => t.startsWith('Release Date:'));
    const [year, month, day] = source.publicationDateOnSnapshot.split('-');
    requireThat(releaseDates.length === 1 && releaseDates[0] === `Release Date: ${Number(month)}/${Number(day)}/${year}`, 'EIA_SNAPSHOT_RELEASE_DATE');
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const values = [], seen = new Set();
    for (const row of rows.slice(2)) {
      const cells = [...row.children].map(c => clean(c.textContent));
      if (!row.querySelector('td.B6')) continue;
      requireThat(cells.length === 11 && /^\d{4}-[A-Z][a-z]{2}$/.test(cells[0]), 'EIA_ROW_SHAPE');
      const rowYear = cells[0].slice(0, 4), rowMonth = months.indexOf(cells[0].slice(5)) + 1;
      requireThat(rowMonth > 0, 'EIA_MONTH');
      for (let column = 2; column <= 10; column += 2) {
        const date = cells[column - 1], rawValue = cells[column];
        if (!date) { requireThat(!rawValue, 'EIA_VALUE_WITHOUT_DATE'); continue; }
        requireThat(/^\d{2}\/\d{2}$/.test(date) && Number(date.slice(0, 2)) === rowMonth, 'EIA_WEEK_DATE');
        const period = `${rowYear}-${date.replace('/', '-')}`, parsedDate = new Date(`${period}T00:00:00Z`);
        requireThat(Number.isFinite(+parsedDate) && parsedDate.toISOString().slice(0, 10) === period && parsedDate.getUTCDay() === 5, 'EIA_WEEK_DATE');
        requireThat(!seen.has(period), 'EIA_DUPLICATE_PERIOD'); seen.add(period);
        if (period < window.start || period > window.end) continue;
        let value = null;
        if (!['', '-', '--', 'NA', 'W'].includes(rawValue)) {
          requireThat(/^(?:\d{1,3}(?:,\d{3})+|\d+)$/.test(rawValue), 'EIA_NUMBER');
          value = Number(rawValue.replaceAll(',', '')); requireThat(Number.isSafeInteger(value), 'EIA_NUMBER');
        }
        values.push({ period, value, row: cells, column, locator: `table.FloatTitle/tr[td.B6="${cells[0]}"]/td[${column + 1}]` });
      }
    }
    requireThat(values.length > 0, 'EIA_EMPTY_WINDOW');
    return values.sort((a, b) => a.period.localeCompare(b.period));
  } finally { dom.window.close(); }
}
