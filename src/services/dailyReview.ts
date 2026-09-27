import { reviewRecordSchema, validateReview, type ReviewHistory, type ReviewRead } from '../../shared/daily-review.mjs';

export async function dailyReviewRequest(action: string, secret: string, input?: unknown, signal?: AbortSignal): Promise<unknown> {
  const controller = new AbortController(), abort = () => controller.abort();
  const timer = setTimeout(abort, 20000);
  signal?.addEventListener('abort', abort, { once: true });
  try {
  if (signal?.aborted) throw new DOMException('Review request cancelled', 'AbortError');
  const response = await fetch(`/api/daily-review/${action}`, { method: input === undefined ? 'GET' : 'POST', cache: 'no-store', credentials: 'same-origin',
    headers: { 'X-Bridge-Owner-Secret': secret, ...(input === undefined ? {} : { 'Content-Type': 'application/json' }) },
    ...(input === undefined ? {} : { body: JSON.stringify(input) }), signal: controller.signal });
  if (!response.ok) throw Error(response.status === 401 ? '访问密钥无效，请重新连接。' : response.status === 503 ? '每日复盘服务尚未配置，暂不能读取。' : '每日复盘读取或操作失败，请重试。');
  const raw = await response.text(); if (raw.length > 100000) throw Error('复盘响应超出限制。');
  try { return JSON.parse(raw); } catch { throw Error('每日复盘服务尚未接入，暂不能读取。'); }
  } finally { clearTimeout(timer); signal?.removeEventListener('abort', abort); }
}
export function validateReviewRead(input: unknown): ReviewRead {
  if (!input || typeof input !== 'object' || !('record' in input) || !('scope' in input) || !['real','synthetic'].includes(String(input.scope)) || !('effectiveStatus' in input) || !('isCurrent' in input) || typeof input.isCurrent !== 'boolean') throw Error('复盘响应无效。');
  const record = input.record === null ? null : reviewRecordSchema.parse(input.record);
  if (record) validateReview(record.content);
  if ((record === null && input.effectiveStatus !== null) || (record && input.effectiveStatus !== (input.isCurrent ? record.status : 'SUPERSEDED'))) throw Error('复盘版本状态不一致。');
  return { record, effectiveStatus: input.effectiveStatus as ReviewRead['effectiveStatus'], isCurrent: input.isCurrent, scope: input.scope as ReviewRead['scope'] };
}
export function validateReviewHistory(input: unknown): ReviewHistory {
  if (!input || typeof input !== 'object' || !('items' in input) || !Array.isArray(input.items) || input.items.length > 20 || !('next' in input) || (input.next !== null && (!Number.isSafeInteger(input.next) || Number(input.next) < 0))) throw Error('历史响应无效。');
  for (const item of input.items) if (!item || typeof item.reviewDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(item.reviewDate) || !Number.isSafeInteger(item.revision) || item.revision < 1 || typeof item.status !== 'string') throw Error('历史响应无效。');
  return input as ReviewHistory;
}
