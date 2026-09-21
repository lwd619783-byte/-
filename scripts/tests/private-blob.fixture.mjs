import assert from 'node:assert/strict';
import { BlobPreconditionFailedError } from '@vercel/blob';
import { PrivateBlobStore } from '../../server/research-bridge/store.mjs';

/** Synthetic SDK transport; exercise the production repository, pagination and atomic ETags. */
export function privateStoreFixture() {
  const objects = new Map(); let serial = 0;
  const sdk = {
    async get(key, options) {
      assert.equal(options.access, 'private'); assert.equal(options.useCache, false);
      const row = objects.get(key); if (!row) return null;
      return { statusCode: 200, blob: { url: `https://synthetic.private.blob.vercel-storage.com/${key}`, etag: row.etag }, stream: new Response(row.body).body };
    },
    async put(key, body, options) {
      assert.equal(options.access, 'private'); assert.equal(options.addRandomSuffix, false);
      const old = objects.get(key);
      if (options.ifMatch && old?.etag !== options.ifMatch) throw new BlobPreconditionFailedError();
      if (old && !options.allowOverwrite) throw new Error('EXISTS');
      if (old) assert.ok(options.ifMatch, 'no unconditional overwrite');
      const row = { body, etag: `etag-${++serial}` }; objects.set(key, row);
      return { url: `https://synthetic.private.blob.vercel-storage.com/${key}`, etag: row.etag };
    },
    async list({ prefix, limit, cursor = '0' }) {
      const keys = [...objects.keys()].filter(k => k.startsWith(prefix)).sort(), start = Number(cursor), end = start + limit;
      return { blobs: keys.slice(start, end).map(pathname => ({ pathname, url: `https://synthetic.private.blob.vercel-storage.com/${pathname}` })), hasMore: end < keys.length, cursor: String(end) };
    },
  };
  return { store: new PrivateBlobStore(sdk), sdk, objects };
}
