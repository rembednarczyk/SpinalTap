/**
 * `pnpm gugik:nmpt` (second half): the cached NMPT tiles (`nmpt-fetch.ts`) less the NMT of
 * `data/terrain`, per district, into `data/gugik/nmpt/<district>.{json,bin}` (`nmpt.ts`). No
 * network. A district with a tile missing from the cache keeps its extract as it was, so a run
 * without the cache never empties the data.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { DISTRICTS } from "../../osm-import/src/config.ts";
import { DSM_STEP, NMPT_DIR, TILE, districtBox, dtmAt, loadDistrictDtm, reduceChm, tileFile, tilesOf } from "./nmpt.ts";

const side = TILE / DSM_STEP;
mkdirSync(NMPT_DIR, { recursive: true });
for (const d of DISTRICTS) {
  const box = districtBox(d);
  const tiles = tilesOf(box);
  const missing = tiles.filter((t) => !existsSync(tileFile(t.e, t.n)));
  const dtm = loadDistrictDtm(d.slug);
  if (missing.length || !dtm) {
    console.log(`nmpt ${d.slug}: ${missing.length} of ${tiles.length} tiles not in the cache${dtm ? "" : ", no NMT"}: extract kept`);
    continue;
  }
  const grids = new Map(tiles.map((t) => [`${t.e},${t.n}`, new Float32Array(new Uint8Array(readFileSync(tileFile(t.e, t.n))).buffer)]));
  const dsm = (e: number, n: number): number => {
    const te = Math.floor(e / TILE) * TILE;
    const tn = Math.floor(n / TILE) * TILE;
    const g = grids.get(`${te},${tn}`);
    if (!g) return Number.NaN;
    const c = Math.floor((e - te) / DSM_STEP);
    const r = side - 1 - Math.floor((n - tn) / DSM_STEP);
    return g[r * side + c] ?? Number.NaN;
  };
  const chm = reduceChm(box, dsm, dtmAt(dtm));
  writeFileSync(join(NMPT_DIR, `${d.slug}.json`), `${JSON.stringify(chm.header, null, 2)}\n`);
  writeFileSync(join(NMPT_DIR, `${d.slug}.bin`), chm.cells);
  const crown = chm.cells.reduce((s, v) => s + (v >= 15 && v !== chm.header.noData ? 1 : 0), 0);
  console.log(`nmpt ${d.slug}: ${chm.header.cols}×${chm.header.rows} m, ${crown} m² 3 m over the ground or more`);
}
