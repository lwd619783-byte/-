import { describe, expect, it } from 'vitest';
import type { CreatorViewpointData } from '../types/creatorViewpoint';
import { createEmptyCreatorViewpointData } from './creatorViewpoint';
import { exportCreatorViewpointExcel } from './creatorViewpointExport';

const at = '2026-09-01T08:00:00.000Z';
const later = '2026-09-21T08:00:00.000Z';
function fixture(): CreatorViewpointData {
  const data = createEmptyCreatorViewpointData();
  data.creators = [{ id: 'creator', name: '中文 & synthetic creator', profileUrl: null, recordedAt: at }];
  data.sources = [{ id: 'source', creatorId: 'creator', kind: 'post', url: 'https://example.com/source', publishedAt: at, publishedAtLabel: 'Synthetic label', capturedAt: at, recordedAt: at, content: '=HYPERLINK("https://example.com", "formula-like text")', parentSourceId: null, supersedesId: null, authorIdentity: 'unverified', identityEvidence: null, completeness: 'PARTIAL', commentCoverage: 'PARTIAL' }];
  data.events = [{ id: 'event', scope: 'external', eventType: 'macro_external', title: 'Synthetic event', summary: 'Synthetic summary', sourceName: 'fixture', sourceUrl: null, publishedAt: at, recordedAt: at, eventOccurredAt: at, verificationStatus: 'unverified', supersedesId: null }];
  data.observations = [{ id: 'observation', creatorId: 'creator', topicId: data.topics[0].id, sourceId: 'source', recordedAt: at, summary: 'Conditional synthetic view', reasoning: 'Synthetic explanation', stance: 'cautious', conditional: 'yes', horizon: null, trigger: 'Synthetic trigger', confirmation: null, invalidation: 'Synthetic invalidation', eventLinks: [{ eventId: 'event', relation: 'inferred', explanation: 'Researcher inference only' }], supersedesId: null, revisionReason: null, important: true }];
  data.approvals = [{ id: 'approval', observationId: 'observation', recordedAt: at, decision: 'reviewed', note: 'Transcription review only' }];
  data.reviews = [{ id: 'review', observationId: 'observation', offsetDays: 5, recordedAt: later, status: 'completed', triggerOccurred: 'no', invalidationOccurred: 'unknown', actualOutcome: 'Synthetic subsequent performance', evidence: 'Manual synthetic evidence', evidenceUrl: null, supersedesId: null }];
  return data;
}

/** Independent ZIP reader checks central directory metadata and CRC, not just PK magic. */
function unzip(bytes: Uint8Array): Map<string, string> {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const end = bytes.length - 22;
  expect(view.getUint32(end, true)).toBe(0x06054b50);
  const count = view.getUint16(end + 10, true);
  let position = view.getUint32(end + 16, true);
  const files = new Map<string, string>();
  for (let index = 0; index < count; index++) {
    expect(view.getUint32(position, true)).toBe(0x02014b50);
    const nameLength = view.getUint16(position + 28, true);
    const size = view.getUint32(position + 24, true);
    const local = view.getUint32(position + 42, true);
    const name = new TextDecoder().decode(bytes.slice(position + 46, position + 46 + nameLength));
    expect(view.getUint32(local, true)).toBe(0x04034b50);
    expect(view.getUint16(local + 8, true)).toBe(0);
    const start = local + 30 + view.getUint16(local + 26, true) + view.getUint16(local + 28, true);
    const payload = bytes.slice(start, start + size);
    let remainder = 0xffffffff;
    for (const byte of payload) {
      let n = (remainder ^ byte) & 0xff;
      for (let b = 0; b < 8; b++) n = n % 2 ? (n >>> 1) ^ 0xedb88320 : n >>> 1;
      remainder = (remainder >>> 8) ^ n;
    }
    expect((remainder ^ 0xffffffff) >>> 0).toBe(view.getUint32(position + 16, true));
    files.set(name, new TextDecoder('utf-8', { fatal: true }).decode(payload));
    position += 46 + nameLength + view.getUint16(position + 30, true) + view.getUint16(position + 32, true);
  }
  expect(position).toBe(end);
  return files;
}

describe('Creator viewpoint Excel analysis copy', () => {
  it('writes a real six-sheet OOXML workbook with text cells and all semantic boundaries', () => {
    const files = unzip(exportCreatorViewpointExcel(fixture(), later));
    const workbook = files.get('xl/workbook.xml')!;
    for (const name of ['Creators', 'Current Views', 'Timeline', 'Sources', 'External Events', 'Reviews']) expect(workbook).toContain(`name="${name}"`);
    expect(files.size).toBe(10);
    expect(files.get('xl/worksheets/sheet1.xml')).toContain('中文 &amp; synthetic creator');
    expect(files.get('xl/worksheets/sheet1.xml')).toContain('external_commentary');
    expect(files.get('xl/worksheets/sheet2.xml')).toContain('PARTIAL');
    expect(files.get('xl/worksheets/sheet3.xml')).toContain('inferred');
    expect(files.get('xl/worksheets/sheet3.xml')).toContain('initialization');
    expect(files.get('xl/worksheets/sheet4.xml')).toContain('=HYPERLINK');
    expect(files.get('xl/worksheets/sheet4.xml')).toContain('unverified');
    expect(files.get('xl/worksheets/sheet6.xml')).toContain('calendar_days');
    expect(files.get('xl/worksheets/sheet6.xml')).toContain('Synthetic subsequent performance');
    for (const value of files.values()) expect(value).not.toMatch(/<f(?:\s|>)/);
  });

  it('does not leak future observations, creators, sources, events, approvals or reviews across any sheet', () => {
    const data = fixture();
    data.creators.push({ id: 'future-creator', name: 'FUTURE_CREATOR_SECRET', profileUrl: null, recordedAt: later });
    data.sources.push({ ...data.sources[0], id: 'future-source', creatorId: 'future-creator', publishedAt: later, capturedAt: later, recordedAt: later, content: 'FUTURE_SOURCE_SECRET' });
    data.events.push({ ...data.events[0], id: 'future-event', title: 'FUTURE_EVENT_SECRET', publishedAt: later, recordedAt: later });
    data.observations.push({ ...data.observations[0], id: 'future-observation', creatorId: 'future-creator', sourceId: 'future-source', recordedAt: later, summary: 'FUTURE_OBSERVATION_SECRET', eventLinks: [{ eventId: 'future-event', relation: 'temporal', explanation: null }] });
    data.approvals.push({ id: 'future-approval', observationId: 'future-observation', recordedAt: later, decision: 'reviewed', note: 'FUTURE_APPROVAL_SECRET' });
    data.reviews[0].actualOutcome = 'FUTURE_REVIEW_SECRET';
    const joined = [...unzip(exportCreatorViewpointExcel(data, at)).values()].join('\n');
    expect(joined).not.toContain('FUTURE_');
    expect(joined).not.toContain('future-');
    expect(joined).toContain('pending');
  });

  it('exports draft observations without manufacturing a current view or transition', () => {
    const data = fixture(); data.approvals = []; data.reviews = [];
    const files = unzip(exportCreatorViewpointExcel(data, later));
    expect(files.get('xl/worksheets/sheet3.xml')).toContain('draft');
    expect(files.get('xl/worksheets/sheet3.xml')).toContain('no_transition');
    expect(files.get('xl/worksheets/sheet2.xml')).not.toContain('Conditional synthetic view');
  });

  it('preserves long Unicode excerpts using explicitly labelled continuation cells', () => {
    const data = fixture(); data.sources[0].content = `${'中'.repeat(31999)}🧭${'文'.repeat(5000)}`;
    const source = unzip(exportCreatorViewpointExcel(data, later)).get('xl/worksheets/sheet4.xml')!;
    expect(source).toContain('Content (continued 2)');
    expect(source).toContain('🧭');
    expect(source).not.toContain('\uFFFD');
    expect(source).toContain('中'.repeat(31999));
    expect((source.match(/文/g) ?? []).length).toBeGreaterThanOrEqual(5000);
  });

  it('rejects invalid cutoffs and unknown schema rather than exporting misleading empty sheets', () => {
    expect(() => exportCreatorViewpointExcel(fixture(), 'invalid')).toThrow();
    expect(() => exportCreatorViewpointExcel({ ...fixture(), schemaVersion: 99 } as unknown as CreatorViewpointData)).toThrow();
  });
});
