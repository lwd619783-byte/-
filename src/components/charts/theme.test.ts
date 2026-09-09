import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("frozen UI theme colors", () => {
  const tokens = JSON.parse(readFileSync("docs/ui-redesign/v1/design/theme_tokens.json", "utf8")) as Record<string, Record<string, string>>;
  const css = readFileSync("src/styles/theme-tokens.css", "utf8");

  it.each(["neon", "pro", "light"])("retains every frozen %s token and matching alpha channels", (theme) => {
    const block = css.match(new RegExp(`\\[data-theme="${theme}"\\] \\{([^}]+)\\}`))?.[1];
    expect(block).toBeTruthy();
    for (const [name, hex] of Object.entries(tokens[theme])) {
      if (name === "name") continue;
      expect(block).toContain(`--ui-${name}: ${hex};`);
      const rgb = [1, 3, 5].map((offset) => parseInt(hex.slice(offset, offset + 2), 16)).join(" ");
      expect(block).toContain(`--color-${name}: ${rgb};`);
    }
    expect(block).not.toMatch(/(?:font|margin|padding|width|height|display):/);
  });
});
