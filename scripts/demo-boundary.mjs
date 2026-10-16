import path from 'node:path';
import { isNodeOnlyModule } from './local-core-boundary.mjs';

export function forbiddenDemoModule(id) {
  const name = id.replaceAll('\\', '/').replace(/^\0/, '').split('?')[0];
  return isNodeOnlyModule(name) || /(?:^|\/)(?:src\/data|research-data|public|server|api|\.local-data)(?:\/|$)/.test(name)
    || /\/src\/(?:App|Application|main)\.tsx$/.test(name);
}

/** Inspect the complete resolved graph, including lazy and tree-shaken modules. */
export function demoBoundary() {
  return {
    name: 'synthetic-demo-boundary',
    enforce: 'pre',
    moduleParsed(info) {
      if (forbiddenDemoModule(info.id)) this.error(`DEMO_FORBIDDEN_MODULE: ${info.id}`);
    },
    generateBundle(_options, bundle) {
      const modules = [...this.getModuleIds()];
      if (modules.some(forbiddenDemoModule)) this.error('DEMO_FORBIDDEN_GRAPH');
      const files = Object.values(bundle).map(output => output.fileName);
      if (files.some(file => !/^(?:index\.html|assets\/[\w.-]+\.(?:js|css))$/.test(file))) this.error('DEMO_UNEXPECTED_ASSET');
      this.emitFile({ type: 'asset', fileName: 'demo-boundary.json', source: JSON.stringify({
        scope: 'synthetic-only', status: 'passed', publicDir: false, services: 'disabled',
        modules: modules.map(id => id.replace(/^\0/, '').replaceAll(process.cwd() + path.sep, '')).sort(),
        files: files.sort(),
      }, null, 2) + '\n' });
    },
  };
}
