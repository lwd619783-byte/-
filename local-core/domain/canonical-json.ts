import { fail } from './errors.js';

export function canonicalJson(value: unknown): string {
  const ancestors = new Set<object>();
  function encode(item: unknown): string {
    if (item === null || typeof item === 'boolean' || typeof item === 'string') return JSON.stringify(item);
    if (typeof item === 'number' && Number.isFinite(item)) return JSON.stringify(item);
    if (typeof item !== 'object' || !item || ancestors.has(item)) return fail('CONTRACT_INVALID', 'Canonical payload must be finite, acyclic JSON.');
    ancestors.add(item);
    let encoded: string;
    if (Array.isArray(item)) {
      if (Object.keys(item).length !== item.length || Object.getOwnPropertySymbols(item).length) return fail('CONTRACT_INVALID', 'Sparse or extended arrays are not JSON payloads.');
      const values: string[] = [];
      for (let index = 0; index < item.length; index += 1) {
        const descriptor = Object.getOwnPropertyDescriptor(item, String(index));
        if (!descriptor || !('value' in descriptor)) return fail('CONTRACT_INVALID', 'Sparse arrays or JSON getters are not supported.');
        values.push(encode(descriptor.value));
      }
      encoded = `[${values.join(',')}]`;
    } else {
      if (![Object.prototype, null].includes(Object.getPrototypeOf(item) as object | null) || Object.getOwnPropertySymbols(item).length) return fail('CONTRACT_INVALID', 'Canonical payload must contain plain JSON objects.');
      encoded = `{${Object.keys(item).sort().map((key) => {
        const descriptor = Object.getOwnPropertyDescriptor(item, key)!;
        if (!('value' in descriptor)) return fail('CONTRACT_INVALID', 'JSON getters are not supported.');
        return `${JSON.stringify(key)}:${encode(descriptor.value)}`;
      }).join(',')}}`;
    }
    ancestors.delete(item);
    return encoded;
  }
  return encode(value);
}
