/**
 * `pnpm orto:widths [--check] [--list]`: the carriageway widths measured on the orthophoto
 * (`widths.ts`, ADR-0080 PR 10), written as the generated table
 * `tools/osm-import/src/ortho-widths.generated.ts` the import reads as corrections of the ways'
 * widths (source `ortho`). Offline: the committed OSM extracts, `data/orto/*.cover.png` and the
 * current image in the orthophoto tool's cache (`defaultCache()`; the table is what is committed).
 * `--check` fails when the table differs from what the data give; `--list` prints every way.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { TABLE_FILE, measureFromCache, tableText, widthsReport } from "./widths-city.ts";

const argv = process.argv.slice(2);
const t0 = performance.now();
const measured = measureFromCache();
const text = tableText(measured);
console.log(widthsReport(measured));
if (argv.includes("--list")) {
  for (const { id, name, estimate, measure: m } of measured) {
    const side = (s: typeof m.left) => `${s.median ?? "-"} (${s.agree}/${s.kept}/${s.stations})`;
    console.log(`${id} ${name} est ${estimate} ${m.reason} ${m.width ?? "-"} L ${side(m.left)} R ${side(m.right)}`);
  }
}
if (argv.includes("--check")) {
  if (readFileSync(TABLE_FILE, "utf8") !== text) {
    console.error(`${TABLE_FILE} differs from the data: run pnpm orto:widths`);
    process.exit(1);
  }
} else writeFileSync(TABLE_FILE, text);
console.log(`${((performance.now() - t0) / 1000).toFixed(1)} s`);
