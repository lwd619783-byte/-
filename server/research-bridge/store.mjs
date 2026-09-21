import { get, put, list, BlobPreconditionFailedError } from '@vercel/blob';

/** Private-only, strongly consistent reads. Never returns a Blob URL to a client. */
export class PrivateBlobStore {
  constructor(sdk = { get, put, list }) { this.sdk = sdk; }
  async get(key) {
    return (await this.versioned(key))?.value ?? null;
  }
  async versioned(key) {
    const result = await this.sdk.get(key, { access: 'private', useCache: false });
    if (!result) return null;
    if (result.statusCode !== 200) throw new Error('STAGING_READ_FAILED');
    if (!new URL(result.blob.url).hostname.endsWith('.private.blob.vercel-storage.com')) throw new Error('PRIVATE_STORE_REQUIRED');
    if (!result.blob.etag) throw new Error('STAGING_ETAG_REQUIRED');
    return { value: JSON.parse(await new Response(result.stream).text()), etag: result.blob.etag };
  }
  async putNew(key, value) {
    const result = await this.sdk.put(key, JSON.stringify(value), { access: 'private', addRandomSuffix: false, allowOverwrite: false, contentType: 'application/json' });
    if (!new URL(result.url).hostname.endsWith('.private.blob.vercel-storage.com')) throw new Error('PRIVATE_STORE_REQUIRED');
  }
  /** Only batch access pointers may change; source, manifest and audit objects stay immutable. */
  async compareExchange(key, expectedEtag, value) {
    try {
      const result = await this.sdk.put(key, JSON.stringify(value), { access: 'private', addRandomSuffix: false, contentType: 'application/json',
        ...(expectedEtag ? { allowOverwrite: true, ifMatch: expectedEtag } : { allowOverwrite: false }) });
      if (!new URL(result.url).hostname.endsWith('.private.blob.vercel-storage.com')) throw new Error('PRIVATE_STORE_REQUIRED');
      return true;
    } catch (error) {
      if (error instanceof BlobPreconditionFailedError) return false;
      // A racing initial create is safe to retry; all other storage failures remain errors.
      if (!expectedEtag && await this.versioned(key)) return false;
      throw error;
    }
  }
  async keys(prefix) {
    const result = [], max = 500; let cursor;
    do {
      const page = await this.sdk.list({ prefix, limit: 100, ...(cursor ? { cursor } : {}) });
      for (const blob of page.blobs) { if (!new URL(blob.url).hostname.endsWith('.private.blob.vercel-storage.com')) throw new Error('PRIVATE_STORE_REQUIRED'); result.push(blob.pathname); }
      if (result.length > max) throw new Error('STAGING_LIST_LIMIT');
      cursor = page.hasMore ? page.cursor : undefined;
    } while (cursor);
    return result;
  }
}
