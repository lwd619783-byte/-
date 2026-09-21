import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("UI V2 single light palette", () => {
  // V1 theme_tokens.json is historical evidence; UI V2 deliberately supersedes its runtime palette.
  const tokens: Record<string, string> = {
    bg: "#F6F7F8", panel: "#FFFFFF", raised: "#F0F3F4", text: "#202B31", muted: "#536581",
    weak: "#576A82", border: "#CBD5E1", control: "#6B7E94", accent: "#356D69", secondary: "#356D69",
    up: "#BA1A35", down: "#00755B", warning: "#865700", error: "#B41D35", info: "#356D69",
    onaccent: "#FFFFFF", selected: "#E9F1EF",
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
