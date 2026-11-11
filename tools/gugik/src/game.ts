/**
 * The game's buildings and barrier lines for the GUGiK report (ADR-0077): buildings straight
 * from `packages/sim/src/content/lublin/*.generated.ts` (what the game builds), names and
 * addresses and the `barrier=*` ways from the OSM extracts `data/osm/<district>.json`.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { KRAKOWSKIE_CHUNKS } from "../../../packages/sim/src/content/lublin/krakowskie.generated.ts";
import { NABRZEZE_CHUNKS } from "../../../packages/sim/src/content/lublin/nabrzeze.generated.ts";
import { PODZAMCZE_CHUNKS } from "../../../packages/sim/src/content/lublin/podzamcze.generated.ts";
import { STARE_MIASTO_CHUNKS } from "../../../packages/sim/src/content/lublin/stare-miasto.generated.ts";
import type { LublinChunkData } from "../../../packages/sim/src/content/lublin/types.ts";
import { centroid, pointInRing, type Pt } from "../../osm-import/src/geometry.ts";
import { mergeOsm, type OsmData, parseExtract, type Tags } from "../../osm-import/src/osm.ts";
import { REPO } from "../../osm-import/src/paths.ts";
import { geoToWorld } from "../../osm-import/src/project.ts";

/** The game's flat point lists (`[x0, z0, x1, z1, …]`, not delta-coded). */
const unflat = (v: readonly number[]): Pt[] => {
  const out: Pt[] = [];
  for (let i = 0; i + 1 < v.length; i += 2) out.push({ x: v[i]!, z: v[i + 1]! });
  return out;
};

export const GAME_CHUNKS: readonly LublinChunkData[] = [...KRAKOWSKIE_CHUNKS, ...STARE_MIASTO_CHUNKS, ...PODZAMCZE_CHUNKS, ...NABRZEZE_CHUNKS];

export interface GameBuilding {
  readonly id: string;
  readonly cell: string;
  /** World outline (absolute x, z). */
  readonly ring: Pt[];
  /** Eaves over the foot (`height`) and the roof above them (`roof`, 0 when flat). */
  readonly height: number;
  readonly roof: number;
  readonly roofShape?: string;
  readonly source: string;
  /** A `building:part` lifted onto another building (`soffit`): not a footprint of its own. */
  readonly part: boolean;
  /** The highest middle of roof (`height + roof / 2`) of the parts standing on it (a tower, a helmet). */
  readonly partsMid?: number;
  readonly name?: string;
}

const flatBuildings = (chunks: readonly LublinChunkData[]): GameBuilding[] =>
  chunks.flatMap((c) =>
    c.buildings.map((b) => ({
      id: b.id,
      cell: c.id,
      ring: unflat(b.outline).map((p) => ({ x: p.x + b.x, z: p.z + b.z })),
      height: b.height,
      roof: b.roof ?? 0,
      source: b.source,
      part: b.soffit !== undefined,
      ...(b.roofShape ? { roofShape: b.roofShape } : {}),
      ...(b.name ? { name: b.name } : {}),
    })),
  );

/** The game's buildings; parts lifted onto a building (`soffit`) also lend it their height. */
export const gameBuildings = (chunks: readonly LublinChunkData[] = GAME_CHUNKS): GameBuilding[] => {
  const all = flatBuildings(chunks);
  const parts = all.filter((b) => b.part);
  return all.map((b) => {
    if (b.part) return b;
    const on = parts.filter((p) => pointInRing(centroid(p.ring), b.ring)).map((p) => p.height + p.roof / 2);
    return on.length ? { ...b, partsMid: Math.max(...on) } : b;
  });
};

const DISTRICTS = ["krakowskie", "stare-miasto", "podzamcze", "nabrzeze"];

export const loadOsm = (dir = join(REPO, "data/osm")): OsmData => mergeOsm(DISTRICTS.map((d) => parseExtract(readFileSync(join(dir, `${d}.json`), "utf8"))));

/** Tags of a game building's OSM element (`w<id>`, `r<id>`, `r<id>/<k>`). */
export const osmTags = (osm: OsmData, id: string): Tags | undefined => {
  const n = Number(id.slice(1).split("/")[0]);
  return id.startsWith("w") ? osm.ways.get(n)?.tags : osm.relations.get(n)?.tags;
};

export const address = (t: Tags | undefined): string | undefined => {
  if (!t?.["addr:housenumber"]) return undefined;
  return `${t["addr:street"] ?? t["addr:place"] ?? ""} ${t["addr:housenumber"]}`.trim();
};

export interface OsmBarrier {
  readonly id: string;
  readonly kind: string;
  readonly line: Pt[];
}

/** The `barrier=*` ways of the extracts as world lines (closed ways keep their closing point). */
export const osmBarriers = (osm: OsmData): OsmBarrier[] => {
  const out: OsmBarrier[] = [];
  for (const w of osm.ways.values()) {
    const kind = w.tags?.barrier;
    if (!kind) continue;
    const line = w.nodes.flatMap((id) => {
      const n = osm.nodes.get(id);
      return n ? [geoToWorld(n.lat, n.lon)] : [];
    });
    if (line.length >= 2) out.push({ id: `w${w.id}`, kind, line });
  }
  return out;
};
