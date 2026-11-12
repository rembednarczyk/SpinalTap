/**
 * `pnpm gugik:fetch [--refresh]` (ADR-0077): downloads the three GUGiK sets of powiat 0663
 * (Lublin) into a cache outside the repo, `${XDG_CACHE_HOME:-~/.cache}/seki-gugik`, and unpacks
 * each into a directory of its own. Network, by hand, never in the build. The archives are
 * untrusted data: they are only unzipped and then read as text (GML) or as an SQLite file
 * (GPKG), never run. One request per file, no retries: an HTTP 429 or any other error stops it.
 * Behind a proxy run it with `NODE_USE_ENV_PROXY=1`.
 *
 * The manifest `data/gugik/sources.json` keeps for each set its address, download date,
 * `Last-Modified`, size, sha256 and licence. A cached or downloaded file whose sha256 differs
 * from the manifest is reported (the set changed upstream; re-run `pnpm gugik:extract`).
 */
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { DATA_DIR } from "./extracts.ts";
import { CACHE_DIR, LICENSE, SOURCES } from "./sources.ts";

/** Who asks (ADR-0042: no user data). */
const USER_AGENT = "SekiSenshi-topo/1.0";
const refresh = process.argv.includes("--refresh");
const MANIFEST = join(DATA_DIR, "sources.json");

export interface SourceEntry {
  readonly url: string;
  readonly fetched: string;
  readonly lastModified: string | null;
  readonly bytes: number;
  readonly sha256: string;
  readonly license: string;
}

const manifest: Record<string, SourceEntry> = existsSync(MANIFEST) ? (JSON.parse(readFileSync(MANIFEST, "utf8")) as Record<string, SourceEntry>) : {};
const sha256 = (b: Uint8Array) => createHash("sha256").update(b).digest("hex");

mkdirSync(CACHE_DIR, { recursive: true });
for (const s of SOURCES) {
  const zip = join(CACHE_DIR, `${s.key}.zip`);
  const known = manifest[s.key];
  let fresh = false;
  if (refresh || !existsSync(zip)) {
    console.log(`gugik ${s.key}: ${s.url}`);
    const res = await fetch(s.url, { headers: { "User-Agent": USER_AGENT } });
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}: ${s.url} (no retry)`);
    const body = new Uint8Array(await res.arrayBuffer());
    writeFileSync(zip, body);
    manifest[s.key] = {
      url: s.url,
      fetched: new Date().toISOString().slice(0, 10),
      lastModified: res.headers.get("last-modified"),
      bytes: body.byteLength,
      sha256: sha256(body),
      license: LICENSE,
    };
    fresh = true;
  }
  const sum = fresh ? manifest[s.key]!.sha256 : sha256(readFileSync(zip));
  if (known && known.sha256 !== sum) console.warn(`gugik ${s.key}: WARNING sha256 ${sum} differs from the manifest (${known.sha256}, ${known.fetched}): the set changed, re-run pnpm gugik:extract`);
  if (!manifest[s.key]) console.warn(`gugik ${s.key}: not in the manifest; run with --refresh to record it`);
  const dir = join(CACHE_DIR, s.key);
  if (fresh || !existsSync(dir) || readdirSync(dir).length === 0) {
    mkdirSync(dir, { recursive: true });
    // `unzip` refuses absolute paths and `..` in entry names; nothing unpacked is executed.
    execFileSync("unzip", ["-o", "-q", zip, "-d", dir], { stdio: "inherit" });
  }
  console.log(`gugik ${s.key}: ${dir} (sha256 ${sum.slice(0, 12)}…)`);
}
mkdirSync(DATA_DIR, { recursive: true });
writeFileSync(MANIFEST, `${JSON.stringify(manifest, null, 1)}\n`);
