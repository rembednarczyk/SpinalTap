/** Map features in world metres: closed areas (ways and multipolygons) and open lines. */
import { type OsmData, type OsmWay, type Tags } from "./osm.ts";
import { type Pt, openRing } from "./geometry.ts";
import { geoToWorld } from "./project.ts";

export interface Area {
  /** `w<id>` for a way, `r<id>` (or `r<id>/<k>` for the k-th outer ring) for a relation. */
  readonly id: string;
  readonly osmId: number;
  readonly tags: Tags;
  readonly ring: readonly Pt[];
  /** Courtyards and other holes of a multipolygon (kept for reports; outlines ignore them). */
  readonly holes: number;
}

export interface Line {
  readonly id: string;
  readonly osmId: number;
  readonly tags: Tags;
  readonly line: readonly Pt[];
}

const wayPoints = (data: OsmData, w: OsmWay): Pt[] | null => {
  const pts: Pt[] = [];
  for (const id of w.nodes) {
    const n = data.nodes.get(id);
    if (!n) return null;
    pts.push(geoToWorld(n.lat, n.lon));
  }
  return pts;
};

const isClosed = (w: OsmWay): boolean => w.nodes.length >= 4 && w.nodes[0] === w.nodes[w.nodes.length - 1];

/** Joins member ways end to end into closed rings of node ids; open leftovers are dropped. */
export const assembleRings = (ways: readonly (readonly number[])[]): number[][] => {
  const rings: number[][] = [];
  const pool = ways.map((w) => [...w]).filter((w) => w.length >= 2);
  while (pool.length > 0) {
    let cur = pool.shift()!;
    let grown = true;
    while (cur[0] !== cur[cur.length - 1] && grown) {
      grown = false;
      for (let i = 0; i < pool.length; i++) {
        const w = pool[i]!;
        const end = cur[cur.length - 1];
        if (w[0] === end) cur = [...cur, ...w.slice(1)];
        else if (w[w.length - 1] === end) cur = [...cur, ...[...w].reverse().slice(1)];
        else continue;
        pool.splice(i, 1);
        grown = true;
        break;
      }
    }
    if (cur.length >= 4 && cur[0] === cur[cur.length - 1]) rings.push(cur);
  }
  return rings;
};

/** Tags that make a closed way an area rather than a loop (a roundabout is a line). */
const isAreaWay = (tags: Tags): boolean => {
  if (tags.area === "no") return false;
  if (tags.area === "yes") return true;
  if (tags.highway && !tags["area:highway"]) return false;
  if (tags.waterway && tags.waterway !== "riverbank") return false;
  if (tags.railway || tags.barrier) return false;
  return true;
};

export const extractFeatures = (data: OsmData): { areas: Area[]; lines: Line[] } => {
  const areas: Area[] = [];
  const lines: Line[] = [];
  const sorted = [...data.ways.values()].sort((a, b) => a.id - b.id);
  for (const w of sorted) {
    if (!w.tags) continue;
    const pts = wayPoints(data, w);
    if (!pts) continue;
    if (isClosed(w) && isAreaWay(w.tags)) areas.push({ id: `w${w.id}`, osmId: w.id, tags: w.tags, ring: openRing(pts), holes: 0 });
    else lines.push({ id: `w${w.id}`, osmId: w.id, tags: w.tags, line: pts });
  }
  const rels = [...data.relations.values()].sort((a, b) => a.id - b.id);
  for (const r of rels) {
    if (!r.tags || (r.tags.type !== "multipolygon" && r.tags.type !== "building")) continue;
    const member = (role: string) =>
      r.members
        .filter((m) => m.type === "way" && (role === "outer" ? m.role !== "inner" : m.role === "inner"))
        .map((m) => data.ways.get(m.ref)?.nodes)
        .filter((n): n is readonly number[] => !!n);
    // An untagged multipolygon takes the tags of its outer way (old-style tagging).
    const tags = Object.keys(r.tags).length > 1 ? r.tags : null;
    if (!tags) continue;
    const outers = assembleRings(member("outer"));
    const inners = assembleRings(member("inner")).length;
    outers.forEach((ids, k) => {
      const pts: Pt[] = [];
      for (const id of ids) {
        const n = data.nodes.get(id);
        if (n) pts.push(geoToWorld(n.lat, n.lon));
      }
      if (pts.length < ids.length) return;
      areas.push({ id: outers.length > 1 ? `r${r.id}/${k}` : `r${r.id}`, osmId: r.id, tags, ring: openRing(pts), holes: inners });
    });
  }
  return { areas, lines };
};
