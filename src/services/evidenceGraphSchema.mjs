import check from './evidenceGraphValidator.generated.mjs';
import policy from '../../contracts/financial-research/v1/relation-policy.v1.json' with { type: 'json' };
export { policy };
export function validateGraph(_name, value) {
  if (!check(value)) throw new Error('F2_SCHEMA_INVALID');
}
