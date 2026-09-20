/** Environment-neutral canonical finite plain JSON. Callers retain their own error authority. */
export function canonicalJson(value, invalid = message => { throw new Error(`CONTRACT_INVALID: ${message}`); }) {
  const ancestors = new Set();
  function encode(item) {
    if (item === null || typeof item === 'boolean' || typeof item === 'string') return JSON.stringify(item);
    if (typeof item === 'number' && Number.isFinite(item)) return JSON.stringify(item);
    if (typeof item !== 'object' || !item || ancestors.has(item)) return invalid('Canonical payload must be finite, acyclic JSON.');
    ancestors.add(item);
    let encoded;
    if (Array.isArray(item)) {
      if (Object.keys(item).length !== item.length || Object.getOwnPropertySymbols(item).length) return invalid('Sparse or extended arrays are not JSON payloads.');
      const values = [];
      for (let index = 0; index < item.length; index += 1) {
        const descriptor = Object.getOwnPropertyDescriptor(item, String(index));
        if (!descriptor || !('value' in descriptor)) return invalid('Sparse arrays or JSON getters are not supported.');
        values.push(encode(descriptor.value));
      }
      encoded = `[${values.join(',')}]`;
    } else {
      if (![Object.prototype, null].includes(Object.getPrototypeOf(item)) || Object.getOwnPropertySymbols(item).length) return invalid('Canonical payload must contain plain JSON objects.');
      encoded = `{${Object.keys(item).sort().map(key => {
        const descriptor = Object.getOwnPropertyDescriptor(item, key);
        if (!('value' in descriptor)) return invalid('JSON getters are not supported.');
        return `${JSON.stringify(key)}:${encode(descriptor.value)}`;
      }).join(',')}}`;
    }
    ancestors.delete(item);
    return encoded;
  }
  return encode(value);
}
