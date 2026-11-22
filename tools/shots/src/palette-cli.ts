/**
 * `pnpm shots:palette <shot.png>...`: the 60-30-10 split of each shot (`palette.ts`, `docs/zasady-lokacji.md`
 * §13), one line a shot: base, motivated light and accents in % and the groups out of their band.
 * Shots from `e2e/glitch-shots.spec.ts` (the canvas only, without the HUD). Code 1 when a shot breaks the rule.
 */
import { readFileSync } from "node:fs";
import { basename } from "node:path";
import { decodeRgb } from "../../orto/src/png.ts";
import { paletteFaults, paletteSplit } from "./palette.ts";

const files = process.argv.slice(2);
if (files.length === 0) {
  console.error("pnpm shots:palette <shot.png>...");
  process.exit(2);
}
let bad = 0;
for (const f of files) {
  const s = paletteSplit(decodeRgb(readFileSync(f)));
  const faults = paletteFaults(s);
  if (faults.length > 0) bad++;
  console.log(`${basename(f, ".png")}: baza ${s.base}%, światło ${s.motivated}%, akcenty ${s.accent}%${faults.length ? `  POZA: ${faults.join("; ")}` : "  zgodne"}`);
}
process.exit(bad > 0 ? 1 : 0);
