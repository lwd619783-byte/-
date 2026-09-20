import { get, put, list } from '@vercel/blob';

/** Private-only, strongly consistent reads. Never returns a Blob URL to a client. */
export class PrivateBlobStore {
  async get(key) {
    const result = await get(key, { access: 'private', useCache: false });
    if (!result) return null;
    if (result.statusCode !== 200) throw new Error('STAGING_READ_FAILED');
    if (!new URL(result.blob.url).hostname.endsWith('.private.blob.vercel-storage.com')) throw new Error('PRIVATE_STORE_REQUIRED');
    return JSON.parse(await new Response(result.stream).text());
  }
  async putNew(key, value) {
    const result = await put(key, JSON.stringify(value), { access: 'private', addRandomSuffix: false, allowOverwrite: false, contentType: 'application/json' });
    if (!new URL(result.url).hostname.endsWith('.private.blob.vercel-storage.com')) throw new Error('PRIVATE_STORE_REQUIRED');
  }
  async keys(prefix) {
    const result = [], max = 500; let cursor;
    do {
      const page = await list({ prefix, limit: 100, ...(cursor ? { cursor } : {}) });
      for (const blob of page.blobs) { if (!new URL(blob.url).hostname.endsWith('.private.blob.vercel-storage.com')) throw new Error('PRIVATE_STORE_REQUIRED'); result.push(blob.pathname); }
      if (result.length > max) throw new Error('STAGING_LIST_LIMIT');
      cursor = page.hasMore ? page.cursor : undefined;
    } while (cursor);
    return result;
  }
}
