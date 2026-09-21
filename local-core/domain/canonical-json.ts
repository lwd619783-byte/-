import { fail } from './errors.js';
import { canonicalJson as encode } from '../../shared/canonical-json.mjs';

/** Preserve LocalCoreError semantics while sharing the pure encoder with browser adapters. */
export function canonicalJson(value: unknown): string {
  return encode(value, message => fail('CONTRACT_INVALID', message));
}
