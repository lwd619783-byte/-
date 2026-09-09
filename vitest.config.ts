import { configDefaults, defineConfig, mergeConfig } from "vitest/config";
import viteConfig from "./vite.config";

export default mergeConfig(viteConfig, defineConfig({
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
