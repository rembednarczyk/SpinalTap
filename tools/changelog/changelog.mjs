#!/usr/bin/env node
// Folds changelog.d/<date>-<slug>.md entries into CHANGELOG.md under "Nieopublikowane",
// grouped by date, newest first, and removes the folded files. One line per file.
import { readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const DIR = "changelog.d";
const MONTHS = ["stycznia", "lutego", "marca", "kwietnia", "maja", "czerwca", "lipca", "sierpnia", "września", "października", "listopada", "grudnia"];

export const heading = (iso) => {
  const [y, m, d] = iso.split("-").map(Number);
  return `### ${d} ${MONTHS[m - 1]} ${y}`;
};

/** Inserts `lines` under `head` in the unreleased section of `text`, creating the date heading when missing. */
export const fold = (text, head, lines) => {
  const bullets = lines.map((l) => `- ${l.replace(/^-\s*/, "").trim()}`).join("\n");
  const at = text.indexOf(`${head}\n`);
  if (at >= 0) {
    const end = at + head.length + 1;
    return `${text.slice(0, end)}${bullets}\n${text.slice(end)}`;
  }
  const section = text.indexOf("## Nieopublikowane");
  const next = text.indexOf("\n", section) + 1;
  return `${text.slice(0, next)}\n${head}\n${bullets}\n${text.slice(next)}`;
};

const main = () => {
  const files = readdirSync(DIR).filter((f) => /^\d{4}-\d{2}-\d{2}-.+\.md$/.test(f)).sort();
  if (files.length === 0) return console.log("changelog: nothing to fold");
  const byDate = new Map();
  for (const f of files) {
    const line = readFileSync(join(DIR, f), "utf8").trim().split("\n")[0];
    const date = f.slice(0, 10);
    byDate.set(date, [...(byDate.get(date) ?? []), line]);
  }
  let text = readFileSync("CHANGELOG.md", "utf8");
  for (const date of [...byDate.keys()].sort()) text = fold(text, heading(date), byDate.get(date));
  writeFileSync("CHANGELOG.md", text);
  for (const f of files) rmSync(join(DIR, f));
  console.log(`changelog: folded ${files.length} entries`);
};

if (import.meta.url === `file://${process.argv[1]}`) main();
