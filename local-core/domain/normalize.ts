export function normalizeEntityText(value: string): string {
  return value.normalize('NFKC').trim().replace(/\s+/gu, ' ').replace(/[A-Z]/g, (letter) => letter.toLowerCase());
}
