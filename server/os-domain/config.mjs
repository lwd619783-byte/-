import { bridgeConfig } from '../research-bridge/auth.mjs';

export function domainConfig(env = process.env) {
  if (env.OS_DOMAIN_ENABLED !== 'true') throw Error('DOMAIN_DISABLED');
  // Shared infrastructure configuration, independently gated service/audience/issuer.
  const base = bridgeConfig({ ...env, BRIDGE_ENABLED: 'true' });
  return { ...base, resource: `${base.origin}/api/os-mcp`, issuer: `${base.origin}/os-domain`, scope: 'os:read', namespace: 'os-domain', authPath: '/api/os-domain' };
}
