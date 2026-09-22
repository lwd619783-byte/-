import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("UI V2 single light palette", () => {
  // V1 theme_tokens.json is historical evidence; UI V2 deliberately supersedes its runtime palette.
  const tokens: Record<string, string> = {
    bg: "#f7f8f4", panel: "#ffffff", raised: "#f0f2eb", text: "#222823", muted: "#69716b",
    weak: "#6d766b", border: "#e4e8e1", control: "#c9d3c6", accent: "#285b44", secondary: "#69716b",
    up: "#9b3834", down: "#285b44", warning: "#855c19", error: "#9b3834", info: "#285b44",
    onaccent: "#ffffff", selected: "#e6eee5",
  };
  const css = readFileSync("src/styles/theme-tokens.css", "utf8");

  it("retains each agreed light color and matching alpha channels for all legacy theme attributes", () => {
    const block = css.match(/:root,\s*\[data-theme\]\s*\{([^}]+)\}/)?.[1];
    expect(block).toBeTruthy();
    for (const [name, hex] of Object.entries(tokens)) {
      expect(block).toContain(`--ui-${name}: ${hex};`);
      const rgb = [1, 3, 5].map((offset) => parseInt(hex.slice(offset, offset + 2), 16)).join(" ");
      expect(block).toContain(`--color-${name}: ${rgb};`);
    }
    expect(block).not.toMatch(/(?:font|margin|padding|width|height|display):/);
    expect(block).toContain("color-scheme: light;");
    expect(css).not.toMatch(/\[data-theme=["'](?:neon|pro|light)["']\]/);
    expect(block).toContain("--ui-panel-gradient: none;");
  });
});
