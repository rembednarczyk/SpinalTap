import { planCanyonSigns } from "../../../packages/engine/src/renderer/mapcity/canyon-signs";
import { facadeFrame } from "../../../packages/engine/src/renderer/mapcity/facade-frame";
import { isLandmarkFrame, landmarkAt, withLandmark } from "../../../packages/engine/src/renderer/mapcity/landmarks";
import { type BuildingSource, mapBuilding } from "../../../packages/engine/src/renderer/mapcity/map-building";
import { BinIndex } from "../../../packages/engine/src/renderer/mapcity/map-index";
import { type P2, boundsOf, cleanRing, pointInRing } from "../../../packages/engine/src/renderer/mapcity/polygon";
import { MAP_SIGN_KIND, planBuildingSigns } from "../../../packages/engine/src/renderer/mapcity/sign-plan";
import { planVenueSigns } from "../../../packages/engine/src/renderer/mapcity/venue-plan";
import { MeshSink } from "../../../packages/engine/src/renderer/mesh-sink";
import { clearedBuilding } from "../../../packages/sim/src/content/cleared-buildings";
import { buildingView } from "../../../packages/sim/src/content/lublin";
import { MAP_CHUNKS } from "../../../packages/sim/src/content/lublin/sites";
import { groundY } from "../../../packages/sim/src/content/lublin/terrain";

/**
 * The map buildings' signs (ADR-0044, ADR-0051, ADR-0064 stage 4) that reach into the solid of
 * another building (G-157, G-159, G-170): every building's signs planned as the map city plans them, each
 * sign's quad walked along its edges every 0.2 m, a point counting where it lies in another
 * building's outline between that one's foot and its top.
 */

export interface SignInNeighbour {
  readonly kind: number;
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly building: string;
  readonly neighbour: string;
  readonly points: number;
}

const STEP = 0.2;

/** Points along the edges of a quad, every `STEP` metres. */
const edgePoints = (c: readonly (readonly [number, number, number])[]): [number, number, number][] => {
  const out: [number, number, number][] = [];
  for (let k = 0; k < 4; k++) {
    const a = c[k]!;
    const b = c[(k + 1) % 4]!;
    const n = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]) / STEP));
    for (let i = 0; i < n; i++) out.push([a[0] + ((b[0] - a[0]) * i) / n, a[1] + ((b[1] - a[1]) * i) / n, a[2] + ((b[2] - a[2]) * i) / n]);
  }
  return out;
};

const KINDS: ReadonlySet<number> = new Set([MAP_SIGN_KIND.ad, MAP_SIGN_KIND.holo, MAP_SIGN_KIND.blade, MAP_SIGN_KIND.venue, MAP_SIGN_KIND.tube]);

let memo: SignInNeighbour[] | null = null;

/** Every sign of the kinds above in another building, one per sign (the faces of a two-faced sign once). */
export const signsInNeighbours = (): SignInNeighbour[] => {
  if (memo) return memo;
  const data = MAP_CHUNKS.flatMap((c) => c.buildings.filter((b) => !clearedBuilding(b)).map((b) => ({ b, district: c.district })));
  const sources = data.map(({ b, district }): BuildingSource => {
    const view = buildingView(b, district) as BuildingSource["view"];
    return { ring: cleanRing(view.outline.map((p) => ({ x: p.x + b.x, z: p.z + b.z }))), view, at: { x: b.x, y: b.y, z: b.z } };
  });
  const index = new BinIndex();
  sources.forEach((s, i) => index.add(i, boundsOf(s.ring)));
  const ground = (x: number, z: number) => groundY(x, z);
  const built = sources.map((s, i) => mapBuilding(i, s, ground, [...index.within(boundsOf(s.ring))].map((o) => sources[o]!)));
  const inside = (x: number, z: number, self: number): number[] => [...index.at(x, z)].filter((o) => o !== self && pointInRing({ x, z }, sources[o]!.ring));
  const neighbour = (x: number, z: number, self: number): number | null => {
    const tops = inside(x, z, self).map((o) => sources[o]!.at.y + sources[o]!.view.height);
    return tops.length ? Math.max(...tops) : null;
  };
  const out: SignInNeighbour[] = [];
  sources.forEach((s, i) => {
    const f = withLandmark(facadeFrame(built[i]!, neighbour), landmarkAt(s.at.x, s.at.z, s.view.outline.length));
    if (isLandmarkFrame(f)) return;
    const sink = new MeshSink();
    planBuildingSigns(sink, f, () => null);
    planVenueSigns(sink, f);
    planCanyonSigns(sink, [f], [], false);
    const mine: SignInNeighbour[] = [];
    for (let v = 0; v + 3 < sink.vertexCount; v += 4) {
      const kind = sink.uvs2[v * 2 + 1]!;
      if (!KINDS.has(kind)) continue;
      const c = [0, 1, 2, 3].map((k) => [sink.positions[(v + k) * 3]!, sink.positions[(v + k) * 3 + 1]!, sink.positions[(v + k) * 3 + 2]!] as const);
      const mid: P2 & { y: number } = { x: c.reduce((a, p) => a + p[0], 0) / 4, y: c.reduce((a, p) => a + p[1], 0) / 4, z: c.reduce((a, p) => a + p[2], 0) / 4 };
      if (mine.some((m) => m.kind === kind && Math.hypot(m.x - mid.x, m.y - mid.y, m.z - mid.z) < 0.15)) continue;
      const hits = edgePoints(c).flatMap(([x, y, z]) => inside(x, z, i).filter((o) => built[o]!.foot < y && y < sources[o]!.at.y + sources[o]!.view.height));
      if (hits.length > 0) mine.push({ kind, ...mid, building: data[i]!.b.id, neighbour: data[hits[0]!]!.b.id, points: hits.length });
    }
    out.push(...mine);
  });
  memo = out;
  return out;
};
