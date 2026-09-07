import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { localCoreBoundary } from "./scripts/local-core-boundary.mjs";

export default defineConfig({
  plugins: [react(), localCoreBoundary()],
});
