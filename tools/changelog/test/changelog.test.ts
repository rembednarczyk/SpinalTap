import { describe, expect, it } from "vitest";
// @ts-expect-error plain ESM script without types
import { fold, heading } from "../changelog.mjs";

const BASE = "# Dziennik zmian\n\n## Nieopublikowane (0.1.0)\n\n### 1 listopada 2026\n- Stara linia.\n";

describe("changelog fragments (changelog.d)", () => {
  it("names the date in Polish", () => {
    expect(heading("2026-11-01")).toBe("### 1 listopada 2026");
  });

  it("adds a fragment on top of an existing date", () => {
    const out = fold(BASE, "### 1 listopada 2026", ["Nowa linia."]);
    expect(out).toContain("### 1 listopada 2026\n- Nowa linia.\n- Stara linia.\n");
  });

  it("opens a new date right under the unreleased heading", () => {
    const out = fold(BASE, "### 2 listopada 2026", ["- Jutro."]);
    expect(out.indexOf("### 2 listopada 2026\n- Jutro.")).toBeLessThan(out.indexOf("### 1 listopada 2026"));
  });
});
