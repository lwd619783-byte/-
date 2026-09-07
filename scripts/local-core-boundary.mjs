import { isBuiltin } from 'node:module';

export function isNodeOnlyModule(id) {
  const normalized = id.replaceAll('\\', '/').replace(/^\0/, '').split('?')[0];
  return isBuiltin(normalized) || /(?:^|\/)(?:local-core|\.local-core-build)(?:\/|$)/.test(normalized) ||
    /(?:^|\/)(?:better-sqlite3|ajv|ajv-formats)(?:\/|$)/.test(normalized) || normalized.includes('__vite-browser-external');
}

/** @returns {import('vite').Plugin} */
export function localCoreBoundary() {
  return {
    name: 'local-core-browser-boundary',
    enforce: 'pre',
    apply: (_config, environment) => !environment.isSsrBuild,
    resolveId(source, importer, options) {
      // Vitest/SSR executes in Node; this gate protects browser module graphs.
      if (!options.ssr && importer && isNodeOnlyModule(source)) this.error('Node-only dependency entered the browser graph.');
      return null;
    },
    moduleParsed(info) {
      if (isNodeOnlyModule(info.id)) this.error('Resolved Node-only dependency entered the browser graph.');
    },
    generateBundle(_options, bundle) {
      const graph = [...this.getModuleIds()];
      const chunks = Object.values(bundle).filter((output) => output.type === 'chunk');
      const emitted = chunks.flatMap((chunk) => Object.keys(chunk.modules));
      if ([...graph, ...emitted].some(isNodeOnlyModule)) this.error('Browser bundle contains a Node-only module.');
      const report = { status: 'passed', checkedGraphModules: graph.length, checkedChunks: chunks.length, forbiddenModules: 0, scope: 'entire browser graph, including lazy chunks and tree-shaken modules' };
      this.emitFile({ type: 'asset', fileName: 'local-core-boundary.json', source: `${JSON.stringify(report, null, 2)}\n` });
      console.log(`Local Core browser boundary: PASS (${graph.length} graph modules, ${chunks.length} chunks, 0 forbidden).`);
    },
  };
}
