import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { localCoreBoundary } from "./scripts/local-core-boundary.mjs";
import { portfolioSeam } from "./scripts/portfolio-seam.mjs";
import { osDomainSeam } from "./scripts/os-domain-seam.mjs";
export default defineConfig({
    plugins: [react(), localCoreBoundary(), portfolioSeam(), osDomainSeam()],
});
