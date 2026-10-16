import { configDefaults, defineConfig, mergeConfig } from "vitest/config";
import viteConfig from "./vite.config";

// Vitest 4 resolves vi.importActual(Node builtins) without Vite's SSR flag.
// This is a Node test runner, not a browser bundle. Browser isolation is still
// enforced by vite.config and the real negative-build tests in test:local-core.
const nodeTestConfig = { ...viteConfig, plugins: viteConfig.plugins?.filter(plugin =>
  plugin && 'name' in plugin && plugin.name !== 'local-core-browser-boundary') };

export default mergeConfig(nodeTestConfig, defineConfig({
  test: {
    exclude: [
      ...configDefaults.exclude,
      "**/data-cache/**",
      "**/.worktrees/**",
      // This existing Node test has its own test:expectations:company-guidance gate.
      "scripts/tests/company-guidance-expectations.test.mjs",
    ],
  },
}));
