import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { EXCEPTIONS, isPolish, scanPackages, scanSource } from "../src/scan";

/**
 * The language ratchet (ADR-0056): Polish text written into `packages/<name>/src` outside the
 * catalogs, counted per package against `i18n-baseline.json`. A count over its baseline fails;
 * a count under it is progress, and the baseline comes down with it (`I18N_BASELINE=update
 * pnpm vitest run tools/i18n-scan`), so it only ever falls, to 0 at the end of the migration.
 * Each finding's place goes to `reports/i18n-scan.json`.
 */

const ROOT = join(__dirname, "..", "..", "..");
const BASELINE = join(__dirname, "i18n-baseline.json");
/** The menus and options moved to the catalogs in stage 1: they stay at 0. */
const STAGE_1_MENUS = ["title-screen", "pause-menu", "save-slots", "settings-panel", "controls-help", "key-label"].map((m) => `packages/ui/src/menus/${m}`);

describe("what counts as Polish", () => {
  it("takes diacritics and frequent Polish words, not English or code", () => {
    for (const t of ["Wróć do gry", "Nowa gra", "Kontrakt dla Kaito", "nie", "Zapisz"]) expect(isPolish(t), t).toBe(true);
    for (const t of ["New Game", "Back", "settings__option", "slot-1", "Mouse0", "../i18n/t", "pending", "dialog", "ladder", "tokens"]) expect(isPolish(t), t).toBe(false);
  });

  it("counts literals, template text and JSX text, never comments", () => {
    const src = [
      "// Wróć: a comment",
      "/* Zapisz",
      "   grę */",
      'const a = "Pełny ekran";',
      "const b = `Slot ${n} gdzie`;",
      "const c = `${x ? `zagnieżdżony` : y}`;",
      "const r = /[ąę]/g; const d = 'ok';",
      "const e = (",
      "  <p className=\"x\">",
      "    Wróć",
      "  </p>",
      ");",
      "const f = <b>Łup</b>;",
      "const g = a / b / 'dzień';",
      "const h = <p>Wróć do gry {tab}</p>;",
      "const i = <b>{n} sztuk, wróć</b>;",
      "const j = <i title=\"Zapisz\" />;",
    ].join("\n");
    expect(scanSource("x.tsx", src).map((f) => f.line)).toEqual([4, 5, 6, 10, 13, 14, 15, 16, 17]);
    // A .ts file has no JSX: bare words on a line are code there.
    expect(scanSource("x.ts", "const x = 1;\n  Wróć\n").map((f) => f.line)).toEqual([]);
  });

  it("explains every exception", () => {
    for (const [path, why] of EXCEPTIONS) {
      expect(existsSync(join(ROOT, path)), path).toBe(true);
      expect(why.length, path).toBeGreaterThan(20);
    }
  });
});

describe("i18n scan (ADR-0056)", () => {
  it("counts Polish text in code per package, never above its baseline", () => {
    const found = scanPackages(ROOT);
    const counts = Object.fromEntries(Object.entries(found).map(([pkg, f]) => [pkg, f.length]));
    mkdirSync(join(ROOT, "reports"), { recursive: true });
    writeFileSync(join(ROOT, "reports/i18n-scan.json"), JSON.stringify({ counts, found }, null, 2));
    if (process.env.I18N_BASELINE === "update" || !existsSync(BASELINE)) writeFileSync(BASELINE, `${JSON.stringify(counts, null, 2)}\n`);
    const baseline = JSON.parse(readFileSync(BASELINE, "utf8")) as Record<string, number>;
    for (const [pkg, n] of Object.entries(counts)) expect(n, `${pkg}: ${n} Polish lines, baseline ${baseline[pkg] ?? 0} (see reports/i18n-scan.json)`).toBeLessThanOrEqual(baseline[pkg] ?? 0);
  });

  it("finds no Polish in the menus and options translated in stage 1", () => {
    const ui = scanPackages(ROOT).ui ?? [];
    expect(ui.filter((f) => STAGE_1_MENUS.some((m) => f.file.startsWith(m)))).toEqual([]);
  });

  it("would turn red on Polish JSX text next to an expression in a stage 1 menu", () => {
    const file = "packages/ui/src/menus/pause-menu.tsx";
    const src = readFileSync(join(ROOT, file), "utf8");
    expect(scanSource(file, src)).toEqual([]);
    const planted = src.replace(/(<h2 className="screen__heading">.*<\/h2>)/, "$1\n      <p>Wróć do gry {tab}</p>");
    expect(planted).not.toBe(src);
    expect(scanSource(file, planted).map((f) => f.text)).toEqual(["Wróć do gry"]);
  });
});
