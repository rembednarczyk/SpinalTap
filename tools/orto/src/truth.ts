/**
 * The ground truth the classifier is tuned on (ADR-0077): the lawns and the setts the curator laid
 * from the orthophoto (T-243, T-245, `ADDED_AREAS`) and the map's own lawns, parks and squares.
 */
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { ADDED_AREAS } from "../../osm-import/src/corrections.ts";
import { extractFeatures } from "../../osm-import/src/features.ts";
import { type Pt, type Rect } from "../../osm-import/src/geometry.ts";
import { type OsmData, type Tags, mergeOsm, parseExtract } from "../../osm-import/src/osm.ts";
import { REPO } from "./config.ts";

export type TruthKind = "lawn" | "paving";

export interface TruthArea {
  readonly id: string;
  readonly kind: TruthKind;
  /** `curator` for the register's areas checked on the orthophoto, `osm` for the map's. */
  readonly from: "curator" | "osm";
  readonly ring: readonly Pt[];
}

/** The curator's register entries whose areas were laid from the orthophoto. */
export const CURATED_REFS: ReadonlySet<string> = new Set(["T-243", "T-245"]);

export const loadOsm = (dir = join(REPO, "data/osm")): OsmData =>
  mergeOsm(
    readdirSync(dir)
      .filter((f) => f.endsWith(".json"))
      .map((f) => parseExtract(readFileSync(join(dir, f), "utf8"))),
  );

const kindOf = (t: Tags): TruthKind | undefined => {
  if (t.landuse === "grass" || t.leisure === "park") return "lawn";
  if (t["area:highway"] === "pedestrian" || t["area:highway"] === "footway") return "paving";
  return undefined;
};

const inside = (ring: readonly Pt[], box?: Rect): boolean => !box || ring.some((p) => p.x > box.minX && p.x < box.maxX && p.z > box.minZ && p.z < box.maxZ);

export const truthAreas = (osm: OsmData, box?: Rect): TruthArea[] => {
  const out: TruthArea[] = [];
  for (const a of ADDED_AREAS) {
    const kind = kindOf(a.tags);
    if (kind && CURATED_REFS.has(a.ref) && inside(a.ring, box)) out.push({ id: a.id, kind, from: "curator", ring: a.ring });
  }
  for (const a of extractFeatures(osm).areas) {
    const kind = kindOf(a.tags);
    if (kind && inside(a.ring, box)) out.push({ id: a.id, kind, from: "osm", ring: a.ring });
  }
  return out;
};
