import { createAuthenticatedReadHandler } from '../shared/read-only-http.mjs';
import { bridgeConfig } from './auth.mjs';
import { ResearchStaging } from './domain.mjs';
import { serveMcp } from './mcp.mjs';

/** Legacy compatibility routes; formal decision tools use a separate handler. */
export function createBridgeHandler({ env = process.env, store } = {}) {
  return createAuthenticatedReadHandler({ env, store, configFactory: bridgeConfig,
    stagingFactory: (store, subject) => new ResearchStaging(store, subject), serve: serveMcp,
    async ownerAction({ req, res, action, url, staging, config, send, body }) {
      if (action === 'status' && req.method === 'GET') { send(res, 200, url.searchParams.has('stageId') ? await staging.status(url.searchParams.get('stageId')) : { status: 'configured', transport: 'streamable-http', endpoint: config.resource }); return; }
      if (req.method !== 'POST') { send(res, 405, { error: 'METHOD_NOT_ALLOWED' }); return; }
      if (!String(req.headers['content-type']).startsWith('application/json')) { send(res, 415, { error: 'JSON_REQUIRED' }); return; }
      const value = JSON.parse(await body(req));
      switch (action) {
        case 'begin': send(res, 200, await staging.begin(value)); break;
        case 'source': await staging.putSource(value.stageId, value.source); send(res, 200, { saved: true }); break;
        case 'knowledge': await staging.putKnowledge(value.stageId, value.document); send(res, 200, { saved: true }); break;
        case 'publish': send(res, 200, await staging.publish(value.stageId)); break;
        case 'revoke': send(res, 200, await staging.revoke(value.stageId)); break;
        case 'revoke-batch': send(res, 200, await staging.revokeBatch(value.batchId)); break;
        default: send(res, 404, { error: 'NOT_FOUND' });
      }
    },
  });
}
