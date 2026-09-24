import { z } from 'zod';
import { createAuthenticatedReadHandler } from '../shared/read-only-http.mjs';
import { domainConfig } from './config.mjs';
import { DecisionStaging } from './staging.mjs';
import { serveDomainMcp } from './mcp.mjs';

export function createDomainHandler({ env = process.env, store, now, scope = 'real' } = {}) {
  return createAuthenticatedReadHandler({ env, store, service: 'domain', configFactory: domainConfig, stagingFactory: (store, subject) => new DecisionStaging(store, subject, now, scope), serve: serveDomainMcp,
    consentTitle: '允许 ChatGPT 只读正式投资状态', consentDescription: '只读取本人显式共享的当前决策快照，包含 Claim、Thesis、投资表达和可读取的组合投影。不会修改正式状态、读取 Wiki 原件或执行交易。授权一小时；快照最多24小时，可随时撤销。',
    async ownerAction({ req, res, action, staging, config, send, body }) {
      if (action === 'status' && req.method === 'GET') { send(res, 200, { ...await staging.status(), endpoint: config.resource }); return; }
      if (req.method !== 'POST') { send(res, 405, { error: 'METHOD_NOT_ALLOWED' }); return; }
      if (req.headers.origin !== config.origin) { send(res, 403, { error: 'ORIGIN_REJECTED' }); return; }
      if (!String(req.headers['content-type']).startsWith('application/json')) { send(res, 415, { error: 'JSON_REQUIRED' }); return; }
      const input = JSON.parse(await body(req));
      if (action === 'publish') { send(res, 200, await staging.publish(input)); return; }
      if (action === 'revoke') { const value = z.object({ expectedGeneration: z.number().int().nonnegative() }).strict().parse(input); send(res, 200, await staging.revoke(value.expectedGeneration)); return; }
      send(res, 404, { error: 'NOT_FOUND' });
    },
  });
}
