#!/usr/bin/env node
/**
 * Downloads the CC0 packs of tools/assets/sources.json (ADR-0058) into DIR and checks their
 * sha256; a file already there with the right hash is kept. Zips are unpacked with the system
 * `unzip` into DIR/<id>/<unzip>/, single files land in DIR/<id>/<path>. The result is what
 * `tools/city_kit.py --props DIR --quaternius DIR/quaternius-cyberpunk-kit` reads.
 *
 *   node tools/assets/fetch.mjs DIR [--only id,id]
 *
 * Behind an HTTPS proxy run it with NODE_USE_ENV_PROXY=1 (Node 22+). Nothing downloaded is ever
 * executed: the packs are data.
 */
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, normalize, sep } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const { sources } = JSON.parse(readFileSync(join(here, "sources.json"), "utf8"));

const args = process.argv.slice(2);
const out = args[0];
if (!out || out.startsWith("--")) {
  console.error("usage: node tools/assets/fetch.mjs DIR [--only id,id]");
  process.exit(2);
}
const onlyAt = args.indexOf("--only");
const only = onlyAt >= 0 ? new Set((args[onlyAt + 1] ?? "").split(",")) : null;

const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");

/** A path inside DIR: no absolute paths and no `..` from the table. */
const inside = (...parts) => {
  const rel = normalize(join(...parts));
  if (rel.startsWith("..") || rel.startsWith(sep)) throw new Error(`path outside the target: ${rel}`);
  return join(out, rel);
};

const fetchChecked = async (url, dst, expected) => {
  if (existsSync(dst) && sha256(readFileSync(dst)) === expected) {
    console.log(`ok    ${dst}`);
    return false;
  }
  const res = await fetch(url, { redirect: "follow" });
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
  const bytes = Buffer.from(await res.arrayBuffer());
  const got = sha256(bytes);
  if (got !== expected) throw new Error(`${url}: sha256 ${got}, expected ${expected}`);
  mkdirSync(dirname(dst), { recursive: true });
  writeFileSync(dst, bytes);
  console.log(`fetch ${dst} (${bytes.length} B)`);
  return true;
};

let failed = 0;
for (const s of sources) {
  if (only && !only.has(s.id)) continue;
  try {
    if (s.url) {
      const zip = inside(s.id, s.file);
      const fresh = await fetchChecked(s.url, zip, s.sha256);
      const target = inside(s.id, s.unzip ?? "x");
      if (fresh || !existsSync(target)) {
        mkdirSync(target, { recursive: true });
        execFileSync("unzip", ["-q", "-o", zip, "-d", target], { stdio: "inherit" });
      }
    }
    for (const f of s.files ?? []) await fetchChecked(f.url, inside(s.id, f.path), f.sha256);
  } catch (err) {
    failed++;
    console.error(`FAIL  ${s.id}: ${err instanceof Error ? err.message : String(err)}`);
  }
}
process.exit(failed > 0 ? 1 : 0);
