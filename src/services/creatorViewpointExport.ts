import { zip } from '../utils/zip';
import type { CreatorViewpointData } from '../types/creatorViewpoint';
import { buildCreatorCurrentViews, buildViewpointReviews, buildViewpointTimeline, validateCreatorViewpointData, visibleViewpointObservations, creatorEffectiveAt, viewpointChronologyStatus } from './creatorViewpoint';

type Cell = string | number | boolean | null | undefined;
type Sheet = { name: string; headers: string[]; rows: Cell[][] };
const UNKNOWN = 'unknown';
const xml = (value: string) => value.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\ufffe\uffff]/g, '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');

function columnName(index: number): string {
  let name = '';
  for (let n = index + 1; n > 0; n = Math.floor((n - 1) / 26)) name = String.fromCharCode(65 + (n - 1) % 26) + name;
  return name;
}

function sheetXml(sheet: Sheet): string {
  // Excel limits one cell to 32,767 UTF-16 code units. Continue long excerpts in
  // explicitly labelled columns; analysis exports never silently truncate text.
  const splitCell = (cell: Cell): string[] => {
    const value = String(cell ?? UNKNOWN);
    const parts: string[] = [];
    for (let start = 0; start < value.length;) {
      let end = Math.min(start + 32000, value.length);
      if (end < value.length && /[\uD800-\uDBFF]/.test(value[end - 1])) end--;
      parts.push(value.slice(start, end)); start = end;
    }
    return parts.length ? parts : [''];
  };
  const cells = sheet.rows.map(row => row.map(splitCell));
  const widths = sheet.headers.map((_, index) => Math.max(1, ...cells.map(row => row[index].length)));
  const expandedHeaders = sheet.headers.flatMap((header, index) => Array.from({ length: widths[index] }, (_, part) => part ? `${header} (continued ${part + 1})` : header));
  const rows = [expandedHeaders, ...cells.map(row => row.flatMap((parts, index) => Array.from({ length: widths[index] }, (_, part) => parts[part] ?? '')))];
  const content = rows.map((row, index) => `<row r="${index + 1}">${row.map((cell, col) => `<c r="${columnName(col)}${index + 1}" t="inlineStr"><is><t xml:space="preserve">${xml(String(cell))}</t></is></c>`).join('')}</row>`).join('');
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><sheetData>${content}</sheetData><autoFilter ref="A1:${columnName(expandedHeaders.length - 1)}${rows.length}"/></worksheet>`;
}

/** Analysis copy only. JSON repository exports remain the complete recovery format. */
export function exportCreatorViewpointExcel(data: CreatorViewpointData, asOf?: string): Uint8Array {
  validateCreatorViewpointData(data);
  asOf ??= new Date().toISOString();
  const cutoff = Date.parse(asOf);
  if (Number.isNaN(cutoff)) throw new Error('导出截止时间无效。');
  const visible = (row: { recordedAt: string }) => Date.parse(row.recordedAt) <= cutoff;
  const creatorName = (id: string) => data.creators.find(row => row.id === id)?.name ?? UNKNOWN;
  const topicName = (id: string) => data.topics.find(row => row.id === id)?.name ?? UNKNOWN;
  const observations = visibleViewpointObservations(data, asOf);
  const observationIds = new Set(observations.map(row => row.id));
  const transitions = buildViewpointTimeline(data, asOf);
  const approvals = data.approvals.filter(row => visible(row) && observationIds.has(row.observationId));
  const sheetList: Sheet[] = [
    { name: 'Creators', headers: ['ID', 'Creator', 'Profile URL', 'Recorded at', 'Semantic class', 'Export use', 'As of'], rows: data.creators.filter(visible).map(row => [row.id, row.name, row.profileUrl, row.recordedAt, data.semanticClass, 'Analysis copy / JSON is recovery format', asOf ?? 'all recorded history']) },
    { name: 'Current Views', headers: ['Creator ID', 'Creator', 'Topic ID', 'Topic', 'Observation ID', 'Stance', 'Conditional', 'Horizon', 'Summary', 'Reasoning', 'Trigger', 'Confirmation', 'Invalidation', 'Source ID', 'Creator effective at', 'Reviewed at (knowledge)', 'Coverage', 'Event relations', 'Last transition creator time', 'Last transition approval time', 'Current chronology health', 'Unresolved observation IDs', 'Current state interpretation'], rows: buildCreatorCurrentViews(data, asOf).map(row => [row.creatorId, creatorName(row.creatorId), row.topicId, topicName(row.topicId), row.observation.id, row.observation.stance, row.observation.conditional, row.observation.horizon, row.observation.summary, row.observation.reasoning, row.observation.trigger, row.observation.confirmation, row.observation.invalidation, row.observation.sourceId, row.effectiveAt, row.reviewedAt, row.coverage, JSON.stringify(row.observation.eventLinks), row.lastTransition?.effectiveAt, row.lastTransition?.recordedAt, row.chronologyHealth, JSON.stringify(row.unresolvedObservationIds), row.chronologyHealth === 'incomplete' ? '最近可确定状态；存在未解析观点，当前状态不完整 / 无法确认' : 'resolved']) },
    { name: 'Timeline', headers: ['Observation ID', 'Creator ID', 'Creator', 'Topic ID', 'Topic', 'Creator effective at', 'Chronology', 'Recorded at (knowledge)', 'Summary', 'Reasoning', 'Stance', 'Conditional', 'Horizon', 'Trigger', 'Confirmation', 'Invalidation', 'Source ID', 'Event relations', 'Supersedes', 'Revision reason', 'Important', 'Review decisions', 'Transition kind', 'Previous observation', 'Transition creator time', 'Transition approval time', 'Semantic class'], rows: observations.map(row => {
      const transition = transitions.find(item => item.next.id === row.id);
      const decisions = approvals.filter(item => item.observationId === row.id);
      return [row.id, row.creatorId, creatorName(row.creatorId), row.topicId, topicName(row.topicId), creatorEffectiveAt(data, row), viewpointChronologyStatus(data, row, asOf), row.recordedAt, row.summary, row.reasoning, row.stance, row.conditional, row.horizon, row.trigger, row.confirmation, row.invalidation, row.sourceId, JSON.stringify(row.eventLinks), row.supersedesId, row.revisionReason, row.important, decisions.length ? JSON.stringify(decisions) : 'draft', transition ? transition.previous ? 'state_transition' : 'initialization' : 'no_transition', transition?.previous?.id, transition?.effectiveAt, transition?.recordedAt, data.semanticClass];
    }) },
    { name: 'Sources', headers: ['ID', 'Creator ID', 'Creator', 'Kind', 'URL', 'Published at', 'Published time label', 'Captured at', 'Recorded at', 'Content', 'Parent source', 'Supersedes', 'Author identity', 'Identity evidence', 'Completeness', 'Comment coverage'], rows: data.sources.filter(row => visible(row) && Date.parse(row.capturedAt) <= cutoff && (row.publishedAt === null || Date.parse(row.publishedAt) <= cutoff)).map(row => [row.id, row.creatorId, creatorName(row.creatorId), row.kind, row.url, row.publishedAt, row.publishedAtLabel, row.capturedAt, row.recordedAt, row.content, row.parentSourceId, row.supersedesId, row.authorIdentity, row.identityEvidence, row.completeness, row.commentCoverage]) },
    { name: 'External Events', headers: ['ID', 'Title', 'Summary', 'Scope', 'Type', 'Occurred at', 'Published at', 'Recorded at', 'Source name', 'Source URL', 'Verification', 'Supersedes', 'Observation relations'], rows: data.events.filter(row => visible(row) && (row.publishedAt === null || Date.parse(row.publishedAt) <= cutoff)).map(row => [row.id, row.title, row.summary, row.scope, row.eventType, row.eventOccurredAt, row.publishedAt, row.recordedAt, row.sourceName, row.sourceUrl, row.verificationStatus, row.supersedesId, JSON.stringify(observations.flatMap(observation => observation.eventLinks.filter(link => link.eventId === row.id).map(link => ({ observationId: observation.id, creatorId: observation.creatorId, ...link }))))]) },
    { name: 'Reviews', headers: ['Row kind', 'Review ID', 'Observation ID', 'Original viewpoint', 'Trigger', 'Confirmation', 'Invalidation', 'Offset days', 'Calendar basis', 'Creator anchor', 'Anchor status', 'Due at', 'Recorded at (manual review)', 'Status', 'Trigger occurred', 'Invalidation occurred', 'Actual outcome', 'Evidence', 'Evidence URL', 'Supersedes'], rows: [] },
  ];
  const reviewSheet = sheetList[5];
  for (const due of buildViewpointReviews(data, asOf)) {
    const observation = observations.find(row => row.id === due.observationId);
    const result = due.result;
    reviewSheet.rows.push(['current_due', result?.id, due.observationId, observation?.summary, observation?.trigger, observation?.confirmation, observation?.invalidation, due.offsetDays, due.basis, due.anchorAt, due.chronology, due.dueAt, result?.recordedAt, result?.status ?? 'pending', result?.triggerOccurred, result?.invalidationOccurred, result?.actualOutcome, result?.evidence, result?.evidenceUrl, result?.supersedesId]);
  }
  for (const review of data.reviews.filter(row => visible(row) && observationIds.has(row.observationId))) {
    const observation = observations.find(row => row.id === review.observationId);
    reviewSheet.rows.push(['history', review.id, review.observationId, observation?.summary, observation?.trigger, observation?.confirmation, observation?.invalidation, review.offsetDays, 'calendar_days', observation ? creatorEffectiveAt(data, observation) : null, observation && creatorEffectiveAt(data, observation) ? 'resolved' : 'unresolved', buildViewpointReviews(data, asOf).find(due => due.observationId === review.observationId && due.offsetDays === review.offsetDays)?.dueAt, review.recordedAt, review.status, review.triggerOccurred, review.invalidationOccurred, review.actualOutcome, review.evidence, review.evidenceUrl, review.supersedesId]);
  }
  const relNs = 'http://schemas.openxmlformats.org/package/2006/relationships';
  const officeNs = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
  return zip([
    { name: '[Content_Types].xml', content: `<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>${sheetList.map((_, index) => `<Override PartName="/xl/worksheets/sheet${index + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')}</Types>` },
    { name: '_rels/.rels', content: `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="${relNs}"><Relationship Id="rId1" Type="${officeNs}/officeDocument" Target="xl/workbook.xml"/></Relationships>` },
    { name: 'xl/workbook.xml', content: `<?xml version="1.0" encoding="UTF-8"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="${officeNs}"><sheets>${sheetList.map((sheet, index) => `<sheet name="${xml(sheet.name)}" sheetId="${index + 1}" r:id="rId${index + 1}"/>`).join('')}</sheets></workbook>` },
    { name: 'xl/_rels/workbook.xml.rels', content: `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="${relNs}">${sheetList.map((_, index) => `<Relationship Id="rId${index + 1}" Type="${officeNs}/worksheet" Target="worksheets/sheet${index + 1}.xml"/>`).join('')}</Relationships>` },
    ...sheetList.map((sheet, index) => ({ name: `xl/worksheets/sheet${index + 1}.xml`, content: sheetXml(sheet) })),
  ]);
}
