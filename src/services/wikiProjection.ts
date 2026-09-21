import type { WikiData, WikiOwners, WikiType } from '../types/wiki';
import { canonicalJson } from '../../shared/canonical-json.mjs';
import { buildWikiReadModel, compareWikiText, resolveWikiRevision, wikiRequire } from './wiki';
import { safeEvidenceUrl } from '../utils/evidenceUrl';

const folders: Record<WikiType, string> = { ENTITY: 'entities', CONCEPT: 'concepts', FRAMEWORK: 'frameworks', TOPIC: 'topics', CREATOR_FRAMEWORK: 'creators', INDUSTRY_KNOWLEDGE: 'industries', MACRO_KNOWLEDGE: 'macro', RESEARCH_CONVENTION: 'conventions' };
const generatedPaths = { index: 'research-wiki/index.md', manifest: 'research-wiki/manifest.json' };
export const WIKI_GENERATED_MARKER = '<!-- generated: research-wiki.v1; source-of-truth: structured-wiki-domain; read-only -->';
export interface WikiVaultManifest {
  schemaVersion: 'wiki-vault.v1'; sourceOfTruth: 'structured-wiki-domain'; asOf: string; domainDigest: string;
  pages: Array<{ wikiId: string; revisionId: string; path: string; sha256: string }>;
  files: Array<{ path: string; sha256: string }>;
}
export interface WikiVault { manifest: WikiVaultManifest; files: Record<string, string> }
export const wikiSha256 = async (text: string): Promise<string> => [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)))].map(byte => byte.toString(16).padStart(2, '0')).join('');

/** Portable path subset. Unicode NFC, no lossy repair of forbidden input. */
export function normalizeWikiPath(input: string): string {
  wikiRequire(typeof input === 'string' && input.length <= 220, 'WIKI_PATH_INVALID');
  const path = input.normalize('NFC');
  wikiRequire(!/[\\<>:"|?*%\u0000-\u001f\u007f]/.test(path) && !/^[/.]/.test(path) && !path.endsWith('/'), 'WIKI_PATH_INVALID');
  const parts = path.split('/');
  wikiRequire(parts.length >= 3 && parts[0] === 'research-wiki' && path.endsWith('.md'), 'WIKI_PATH_ROOT_OR_EXTENSION');
  for (const part of parts) wikiRequire(part.length > 0 && part.length <= 120 && part.trim() === part && !/[. ]$/.test(part)
    && !/^\./.test(part) && !/^(con|prn|aux|nul|com[1-9¹²³]|lpt[1-9¹²³])(?:\.|$)/i.test(part), 'WIKI_PATH_RESERVED_OR_TRAVERSAL');
  return path;
}
const plain = (value: string) => value.replace(/\r\n?/g, '\n');
const text = (value: string) => plain(value).replace(/[\\`*_[\]<>#]/g, '\\$&').replace(/\n/g, ' ');
const code = (value: unknown) => '`' + canonicalJson(value).replace(/`/g, '&#96;') + '`';
const sorted = <T,>(rows: T[]) => [...rows].sort((a, b) => compareWikiText(canonicalJson(a), canonicalJson(b)));
export function relativeWikiLink(from: string, to: string): string {
  const left = from.split('/').slice(0, -1), right = to.split('/');
  while (left.length && right.length && left[0] === right[0]) { left.shift(); right.shift(); }
  return [...left.map(() => '..'), ...right.map(segment => encodeURIComponent(segment).replace(/[!'()*]/g, char => '%' + char.charCodeAt(0).toString(16).toUpperCase()))].join('/');
}

/** Only Domain input can generate a Vault. There is deliberately no Markdown-to-Domain path. */
export async function renderWikiVault(data: WikiData, owners: WikiOwners, asOf: string, paths: Record<string, string> = {}): Promise<WikiVault> {
  const model = buildWikiReadModel(data, owners, asOf);
  const ids = new Set(model.pages.map(page => page.entry.wikiId));
  wikiRequire(Object.keys(paths).every(id => ids.has(id)), 'WIKI_PATH_UNKNOWN_ID');
  const mapping = new Map<string, string>(), used = new Set(Object.values(generatedPaths).map(path => path.normalize('NFKC').toLowerCase()));
  for (const page of model.pages) {
    const path = normalizeWikiPath(Object.prototype.hasOwnProperty.call(paths, page.entry.wikiId) ? paths[page.entry.wikiId] : `research-wiki/${folders[page.entry.type]}/${page.entry.wikiId}.md`);
    const portable = path.normalize('NFKC').toLowerCase();
    wikiRequire(![...used].some(prior => prior === portable || prior.startsWith(`${portable}/`) || portable.startsWith(`${prior}/`)), 'WIKI_PATH_COLLISION');
    used.add(portable); mapping.set(page.entry.wikiId, path);
  }
  const files: Record<string, string> = {};
  const pages: WikiVaultManifest['pages'] = [];
  const link = (from: string, id: string) => {
    const target = model.pages.find(page => page.entry.wikiId === id)!;
    return `[${text(target.revision.title)}](${relativeWikiLink(from, mapping.get(id)!)})`;
  };
  for (const page of model.pages) {
    const r = page.revision, path = mapping.get(page.entry.wikiId)!, trace = resolveWikiRevision(r, owners);
    const metadata = { wikiId: page.entry.wikiId, type: page.entry.type, title: r.title, revisionId: r.revisionId, status: page.status,
      asOf: r.asOf, createdAt: r.createdAt, authorType: r.authorType, origin: page.origin, completeness: page.completeness,
      tags: [...r.tags].sort(compareWikiText), aliases: [...r.aliases].sort(compareWikiText), generated: true, sourceOfTruth: 'structured-wiki-domain' };
    const references: string[] = [];
    for (const source of sorted(trace.sources)) references.push(`- Source ${code(source.ref)}${safeEvidenceUrl(source.provenance.url) ? ` — [original](<${source.provenance.url!.replace(/</g, '%3C').replace(/>/g, '%3E')}>)` : ''}`);
    for (const row of sorted(trace.extractions)) references.push(`- Extraction ${code(row.extraction.ref)} → ${sorted(row.sources.map(source => source.ref)).map(code).join(', ')}`);
    for (const evidence of sorted(r.evidenceRefs)) references.push(`- Evidence ${code(evidence)}`);
    for (const ref of [...r.wikiRefs].sort((a, b) => compareWikiText(a.wikiId, b.wikiId))) references.push(`- Wiki ${link(path, ref.wikiId)} · ${code(ref)}`);
    const markdown = '---\n' + Object.entries(metadata).map(([key, value]) => `${key}: ${JSON.stringify(value)}`).join('\n') + '\n---\n\n'
      + WIKI_GENERATED_MARKER + '\n\n' + `# ${text(r.title)}\n\n${plain(r.summary)}\n\n${plain(r.bodyMarkdown)}\n\n`
      + '## References\n\n' + references.join('\n') + '\n\n## Backlinks\n\n'
      + (page.backlinks.length ? page.backlinks.map(id => `- ${link(path, id)}`).join('\n') : 'No formal Wiki backlinks.')
      + '\n\n## Research memory status\n\n' + `Origin: ${page.origin}. Completeness: ${page.completeness}. Research memory review does not verify facts or publish claims/theses.\n`
      + (page.uncertainty.length ? `\nUncertainty: ${page.uncertainty.map(text).join(', ')}.\n` : '');
    files[path] = markdown;
    pages.push({ wikiId: page.entry.wikiId, revisionId: r.revisionId, path, sha256: await wikiSha256(markdown) });
  }
  files[generatedPaths.index] = WIKI_GENERATED_MARKER + '\n\n# Research Wiki\n\nGenerated read-only projection. Rebuild from structured Wiki Domain. This Vault is not a full backup.\n\n'
    + `Knowledge cutoff: ${asOf}\n\n` + model.pages.map(page => `- ${link(generatedPaths.index, page.entry.wikiId)} · ${page.entry.type} · ${page.origin}`).join('\n') + '\n';
  const hashes = await Promise.all(Object.keys(files).sort(compareWikiText).map(async path => ({ path, sha256: await wikiSha256(files[path]) })));
  const manifest: WikiVaultManifest = { schemaVersion: 'wiki-vault.v1', sourceOfTruth: 'structured-wiki-domain', asOf, domainDigest: await wikiSha256(canonicalJson({ asOf, pages })), pages, files: hashes };
  files[generatedPaths.manifest] = JSON.stringify(manifest, null, 2) + '\n';
  return { manifest, files: Object.fromEntries(Object.entries(files).sort(([a], [b]) => compareWikiText(a, b))) };
}

/** Untrusted file bytes are compared only; they cannot affect the Domain or expected manifest. */
export async function inspectWikiVault(expected: WikiVault, actual: Record<string, string>) {
  const missing = Object.keys(expected.files).filter(path => !(path in actual)).sort(compareWikiText);
  const changed = Object.keys(expected.files).filter(path => path in actual && actual[path] !== expected.files[path]).sort(compareWikiText);
  const unexpected = Object.keys(actual).filter(path => !(path in expected.files)).sort(compareWikiText);
  let stale = false;
  try { const manifest = JSON.parse(actual[generatedPaths.manifest]); stale = manifest.domainDigest !== expected.manifest.domainDigest; } catch { /* missing/corrupt is already a difference */ }
  return { status: missing.length || changed.length || unexpected.length ? stale ? 'stale' as const : 'edited_or_incomplete' as const : 'current' as const, missing, changed, unexpected };
}
