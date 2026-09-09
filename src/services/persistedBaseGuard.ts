import type { StorageLike } from "./watchlistRepository";

/** Exact persisted bytes, captured at read time; never serialized into business data.
 * LocalStorage has no atomic compare-and-set across tabs. This rejects an already
 * changed base at the final synchronous pre-write read, not a simultaneous writer
 * scheduled between getItem and setItem. No storage-event or lock guarantee.
 */
export class PersistedBaseGuard<T extends object> {
  private readonly bases = new WeakMap<T, string | null>();
  private readonly initiallyAbsent: boolean;

  constructor(private readonly storage: StorageLike | null, private readonly key: string) {
    // Compatibility for first creation only: an unbound envelope can initialize
    // storage only against the absence actually read when this repository opened.
    try { this.initiallyAbsent = storage !== null && storage.getItem(key) === null; }
    catch { this.initiallyAbsent = false; }
  }

  remember(data: T, raw: string | null): T {
    this.bases.set(data, raw);
    return data;
  }

  assertCurrent(base: T): string | null {
    const expected = this.bases.has(base) ? this.bases.get(base) : this.initiallyAbsent ? null : undefined;
    if (expected === undefined) throw new Error("缺少读取时的持久化基线，请重新载入后再保存。");
    if (!this.storage || this.storage.getItem(this.key) !== expected) {
      throw new Error("本地数据已变化，保存已拒绝；请重新载入并检查最新历史后再操作。");
    }
    return expected;
  }

  write(data: T, base: T): void {
    const raw = JSON.stringify(data);
    this.assertCurrent(base);
    this.storage!.setItem(this.key, raw);
    this.remember(data, raw);
  }
}
