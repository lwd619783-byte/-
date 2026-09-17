/** Only explicit HTTP(S) owner links can be opened; never synthesize a source URL. */
export function safeEvidenceUrl(value: string | null | undefined): string | null {
  if (!value || !/^https?:\/\//i.test(value)) return null;
  try { const url = new URL(value); return ["http:", "https:"].includes(url.protocol) && !url.username && !url.password ? value : null; } catch { return null; }
}
