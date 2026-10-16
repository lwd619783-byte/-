import { describe, expect, it, vi } from 'vitest';
import { createDemoRuntime } from './runtime';

describe('isolated synthetic demo with original schema and source gates', () => {
  it('uses only memory and seeds reproducible exact pins across sessions', async () => {
    const fetcher = vi.fn(() => { throw Error('UNEXPECTED_NETWORK'); });
    const storage = { getItem: vi.fn(() => { throw Error('UNEXPECTED_USER_STORAGE'); }), setItem: vi.fn() };
    vi.stubGlobal('fetch', fetcher); vi.stubGlobal('localStorage', storage);
    try {
      const a = await createDemoRuntime(), b = await createDemoRuntime();
      expect(a.thesis.repository.load().data).toEqual(b.thesis.repository.load().data);
      expect(a.expression.repository.load().data).toEqual(b.expression.repository.load().data);
      expect(a.expression.owners.scope).toBe('synthetic');
      expect(fetcher).not.toHaveBeenCalled(); expect(storage.getItem).not.toHaveBeenCalled(); expect(storage.setItem).not.toHaveBeenCalled();
    } finally { vi.unstubAllGlobals(); }
  });

  it.each(['thesis', 'expression'] as const)('%s exports and imports an edited synthetic revision after reload with confirmation and append-only checks', async kind => {
    const source = await createDemoRuntime(), target = await createDemoRuntime();
    const repo = source[kind].repository, destination = target[kind].repository;
    // The two repositories have parallel contracts but distinct revision types.
    if (kind === 'thesis') {
      const r = source.thesis.repository, base = r.load().data, old = base.revisions[0];
      r.saveDraft(base, { ...old, revisionId: 'synthetic-demo-edited-thesis', supersedes: old.revisionId, createdAt: new Date().toISOString(), reason: 'Synthetic export roundtrip' });
    } else {
      const r = source.expression.repository, base = r.load().data, old = base.revisions[0];
      r.saveDraft(base, { ...old, revisionId: 'synthetic-demo-edited-expression', supersedes: old.revisionId, createdAt: new Date().toISOString(), reason: 'Synthetic export roundtrip' });
    }
    const raw = kind === 'thesis' ? source.thesis.repository.export(source.thesis.repository.load().data) : source.expression.repository.export(source.expression.repository.load().data);
    // Exercise each typed API directly, including failed confirmation and replay.
    if (kind === 'thesis') {
      const r = target.thesis.repository, before = r.load().data;
      expect(r.previewImport(raw, before).addCount).toBe(1);
      expect(() => r.import(before, raw, false)).toThrow(); expect(r.load().data).toEqual(before);
      r.import(before, raw, true); expect(r.previewImport(raw, r.load().data).addCount).toBe(0);
    } else {
      const r = target.expression.repository, before = r.load().data;
      expect(r.previewImport(raw, before).addCount).toBe(1);
      expect(() => r.import(before, raw, false)).toThrow(); expect(r.load().data).toEqual(before);
      r.import(before, raw, true); expect(r.previewImport(raw, r.load().data).addCount).toBe(0);
    }
    expect(destination.load().data.revisions).toEqual(repo.load().data.revisions);
  });

  it.each(['schema', 'identity', 'source'] as const)('rejects a Thesis import with wrong %s without mutation', async fault => {
    const { thesis } = await createDemoRuntime(), r = thesis.repository, before = r.load().data;
    const envelope = JSON.parse(r.export(before));
    if (fault === 'schema') envelope.data.schemaVersion = 'thesis.v999';
    if (fault === 'identity') envelope.data.revisions[0].relatedEntities[0].id = 'unknown-real-owner';
    if (fault === 'source') envelope.data.revisions[0].supportingClaims[0].revisionBytes = '{}';
    expect(() => r.previewImport(JSON.stringify(envelope), before)).toThrow();
    expect(r.load().data).toEqual(before);
  });

  it.each(['schema', 'scope', 'instrument', 'source'] as const)('rejects an Expression import with wrong %s without mutation', async fault => {
    const { expression } = await createDemoRuntime(), r = expression.repository, before = r.load().data;
    const envelope = JSON.parse(r.export(before)), revision = envelope.data.revisions[0];
    if (fault === 'schema') envelope.data.schemaVersion = 'investment-expression.v999';
    if (fault === 'scope') revision.scope = 'real';
    if (fault === 'instrument') revision.instrument.id = 'unknown-real-instrument';
    if (fault === 'source') revision.thesis.revisionBytes = '{}';
    expect(() => r.previewImport(JSON.stringify(envelope), before)).toThrow();
    expect(r.load().data).toEqual(before);
  });
});
