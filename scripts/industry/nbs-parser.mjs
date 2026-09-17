import { JSDOM } from 'jsdom';

const compact = value => value.replace(/\s+/gu, '');
const requireThat = (ok, message) => { if (!ok) throw new Error(message); };
export function parseNbsProduction(html, period, measure = 'output') {
  requireThat(['output', 'official_yoy'].includes(measure), 'MEASURE_INVALID');
  requireThat(/^\d{4}-(0[2-9]|1[0-2])$/.test(period), 'PERIOD_INVALID');
  const dom = new JSDOM(html); // inert: no scripts, resources or network
  try {
    const document = dom.window.document;
    const [year, monthText] = period.split('-'), month = Number(monthText);
    const text = compact(document.body.textContent);
    requireThat(text.includes(`${year}年${month === 2 ? '1—2' : month}月份规模以上工业生产主要数据`), 'PERIOD_TABLE_TITLE');
    requireThat(text.includes('统计范围为年主营业务收入2000万元及以上的工业企业'), 'STATISTICAL_SCOPE_UNPROVEN');
    const matches = [...document.querySelectorAll('tr')].filter(row => [...row.children].some(cell => compact(cell.textContent) === '工业机器人（套）'));
    requireThat(matches.length > 0, 'ROBOT_ROW_MISSING');
    const rows = matches.map(row => [...row.children].map(cell => compact(cell.textContent)));
    requireThat(new Set(rows.map(JSON.stringify)).size === 1, 'ROBOT_ROWS_CONFLICTED');
    for (const row of matches) {
      const tableRows = [...row.closest('table').querySelectorAll('tr')].slice(0, 3).map(r => [...r.children].map(c => compact(c.textContent)));
      requireThat(tableRows.some(r => JSON.stringify(r) === JSON.stringify(month === 2 ? ['指标', '1—2月'] : ['指标', `${month}月`, `1—${month}月`])), 'BASIS_HEADER');
      requireThat(tableRows.some(r => JSON.stringify(r) === JSON.stringify(Array.from({ length: month === 2 ? 1 : 2 }, () => ['绝对量', '同比增长（%）']).flat())), 'VALUE_COLUMN_HEADER');
    }
    const cells = rows[0];
    requireThat(cells.length === (month === 2 ? 3 : 5), 'ROBOT_COLUMN_COUNT');
    const number = value => {
      if (['', '—', '…', '...', '--'].includes(value)) return null;
      requireThat((measure === 'official_yoy' ? /^-?\d+(?:\.\d+)?$/ : /^\d+(?:\.\d+)?$/).test(value), 'OUTPUT_NUMBER_INVALID');
      const parsed = Number(value); requireThat(Number.isFinite(parsed), 'OUTPUT_NUMBER_INVALID'); return parsed;
    };
    // Page publication is a claim on today's retained bytes, not historical availability proof.
    const dates = [...html.matchAll(/(?:name="PubDate"\s+content="|发布时间：)(\d{4}[-/]\d{2}[-/]\d{2})(?:&nbsp;|\s)+(\d{2}:\d{2})/g)]
      .map(m => `${m[1].replaceAll('/', '-')}T${m[2]}:00+08:00`);
    requireThat(new Set(dates).size <= 1, 'PUBLICATION_CONFLICTED');
    const publicationDateTime = dates[0] ?? null;
    if (publicationDateTime) requireThat(Number.isFinite(Date.parse(publicationDateTime)), 'PUBLICATION_INVALID');
    // Official growth is a native column, never computed from the absolute values.
    const column = measure === 'official_yoy' ? 2 : 1;
    return { publicationDateTime, row: cells, locator: 'table/tr[td="工业机器人（套）"]',
      values: month === 2 ? [{ basis: 'year_to_date', value: number(cells[column]), column }] :
        [{ basis: 'monthly', value: number(cells[column]), column }, { basis: 'year_to_date', value: number(cells[column + 2]), column: column + 2 }] };
  } finally { dom.window.close(); }
}
