import { type AcrossAt, findSpans, planNearCanyon } from "../../../packages/engine/src/renderer/mapcity/canyon-plan";
import { facadeFrame } from "../../../packages/engine/src/renderer/mapcity/facade-frame";
import { landmarkAt, withLandmark } from "../../../packages/engine/src/renderer/mapcity/landmarks";
import { type BuildingSource, mapBuilding } from "../../../packages/engine/src/renderer/mapcity/map-building";
import { BinIndex } from "../../../packages/engine/src/renderer/mapcity/map-index";
import { type Box2, boundsOf, cleanRing, pointInRing } from "../../../packages/engine/src/renderer/mapcity/polygon";
import { MeshSink } from "../../../packages/engine/src/renderer/mesh-sink";
import { clearedBuilding } from "../../../packages/sim/src/content/cleared-buildings";
import { buildingView } from "../../../packages/sim/src/content/lublin";
import { MAP_CHUNKS } from "../../../packages/sim/src/content/lublin/sites";
import { groundY, surfaceY } from "../../../packages/sim/src/content/lublin/terrain";
import { memoAt } from "./point-memo";

/**
 * The cables of the spans over the streets (ADR-0051) that hang low over the paving drawn under
 * them, or into it (G-268): every building's spans found as the map city finds them, each span's
 * cables and lanterns planned on their own, and every edge of their triangles walked every 0.25 m
 * against the drawn surface under it. One finding per span, at its lowest point.
 */

export interface LowCable {
  readonly x: number;
  readonly z: number;
  /** The lowest point's height over the drawn surface under it (m). */
  readonly clearance: number;
  readonly building: string;
}

const STEP = 0.25;

/** The drawn surface by the exact point: the ribbons' edges walk the same points (2.3 million samples, 0.5 million points, G-409). */
const surfaceAt = memoAt(surfaceY);

/** The lowest point of a sink's triangles' edges over the drawn surface, every `STEP` metres. */
const lowest = (sink: MeshSink): { x: number; z: number; clearance: number } => {
  const p = sink.positions;
  let best = { x: 0, z: 0, clearance: Infinity };
  const edge = (i: number, j: number) => {
    const ax = p[i * 3]!, ay = p[i * 3 + 1]!, az = p[i * 3 + 2]!;
    const bx = p[j * 3]!, by = p[j * 3 + 1]!, bz = p[j * 3 + 2]!;
    const n = Math.max(1, Math.ceil(Math.hypot(bx - ax, bz - az) / STEP));
    for (let k = 0; k <= n; k++) {
      const x = ax + ((bx - ax) * k) / n;
      const y = ay + ((by - ay) * k) / n;
      const z = az + ((bz - az) * k) / n;
      const clearance = y - surfaceAt(x, z);
      if (clearance < best.clearance) best = { x, z, clearance };
    }
  };
  for (let t = 0; t + 2 < sink.indices.length; t += 3) {
    const a = sink.indices[t]!, b = sink.indices[t + 1]!, c = sink.indices[t + 2]!;
    edge(a, b);
    edge(b, c);
    edge(c, a);
  }
  return best;
};

let memo: { readonly spans: number; readonly low: LowCable[] } | null = null;

/** The spans of the whole city and those whose cables come within `under` metres of the paving. */
export const lowCables = (under = 2.5): { spans: number; low: LowCable[] } => {
  if (memo) return { spans: memo.spans, low: memo.low.filter((l) => l.clearance < under) };
  const data = MAP_CHUNKS.flatMap((c) => c.buildings.filter((b) => !clearedBuilding(b)).map((b) => ({ b, district: c.district })));
  const sources = data.map(({ b, district }): BuildingSource => {
    const view = buildingView(b, district) as BuildingSource["view"];
    return { ring: cleanRing(view.outline.map((p) => ({ x: p.x + b.x, z: p.z + b.z }))), view, at: { x: b.x, y: b.y, z: b.z } };
  });
  const index = new BinIndex();
  sources.forEach((s, i) => index.add(i, boundsOf(s.ring)));
  const inside = (x: number, z: number, self: number): number[] => [...index.at(x, z)].filter((o) => o !== self && pointInRing({ x, z }, sources[o]!.ring));
  // As `MapEntries` answers them for the map city.
  const neighbour = (x: number, z: number, self: number): number | null => {
    const tops = inside(x, z, self).map((o) => sources[o]!.at.y + sources[o]!.view.height);
    return tops.length ? Math.max(...tops) : null;
  };
  const near = (box: Box2, self: number): Box2[] => [...index.within(box)].filter((o) => o !== self).map((o) => boundsOf(sources[o]!.ring));
  const across: AcrossAt = (x, z, self) => {
    const o = inside(x, z, self)[0];
    if (o === undefined) return null;
    const s = sources[o]!;
    return { id: o, top: s.at.y + s.view.height, clutter: s.view.vertical?.clutter ?? 0 };
  };
  let spans = 0;
  const low: LowCable[] = [];
  sources.forEach((s, i) => {
    const built = mapBuilding(i, s, groundY, [...index.within(boundsOf(s.ring))].map((o) => sources[o]!));
    const f = withLandmark(facadeFrame(built, neighbour, near), landmarkAt(s.at.x, s.at.z, s.view.outline.length));
    for (const span of findSpans(f, across)) {
      spans++;
      // Not a main span: its billboard and footbridge stay out, only the cables and lanterns are drawn.
      const sink = new MeshSink();
      planNearCanyon(sink, [{ ...span, main: false }], false, surfaceY);
      if (sink.empty) continue;
      const l = lowest(sink);
      low.push({ ...l, building: data[i]!.b.id });
    }
  });
  memo = { spans, low };
  return { spans, low: low.filter((l) => l.clearance < under) };
};
