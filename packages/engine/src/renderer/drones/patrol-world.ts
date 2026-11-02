import { DECAL_KINDS, type StreetPropItem, type StreetPropKind, type Vec3, type ViewDescriptor } from "@seki/core";
import { SCENERY_ID_BASE, WORLD_SCENERY, chunkAt, furniturePrisms, groundY, surfaceY } from "@seki/sim";
import { LUBLIN_CHUNKS } from "@seki/sim/lublin";
import { LANTERN_DROP, cablePoint, findSpans, spanBillboard, spanCables, spanFootbridge } from "../mapcity/canyon-plan";
import { CURTAIN_DROP, spanCurtain } from "../mapcity/canyon-signs";
import { facadeFrame } from "../mapcity/facade-frame";
import { isLandmarkFrame, landmarkAt, withLandmark } from "../mapcity/landmarks";
import { cableRuns } from "../mapcity/landmarks/cables";
import { MapEntries } from "../mapcity/map-entries";
import { cellKey } from "../mapcity/map-index";
import { type P2, boundsOf, cleanRing } from "../mapcity/polygon";
import { type WorldProp, toWorld } from "../mapcity/prop-batch";
import { propModel } from "../mapcity/prop-models";
import { PROP_BLOCK } from "../mapcity/prop-shapes";
import { POLE_REACH, isPoleLamp, poleCables, polePairs } from "../mapcity/utility-poles";
import { DRONE_SURFACES, streetAxes, worldRing } from "./drone-world";
import { type AirPost, type AirPrism, PatrolAir, boxRing, runPosts } from "./patrol-air";
import type { PatrolWorld } from "./patrol-lanes";

/**
 * What the low patrols' lanes are planned from (ADR-0058 stage 7b), out of the map's views: the
 * pedestrian streets' axes, their surfaces, the ground and the air over them (`PatrolAir`). The
 * buildings are framed as the map city frames them (ids as the simulation hands the scenery over,
 * `SCENERY_ID_BASE`), so the spans over the streets and their cables, curtains, billboards and
 * footbridges are the ones drawn. Pure but for the memo.
 */

/** The streets the low patrols follow, by OSM `highway`: the pedestrian streets of the Old Town, the deptak and the squares. */
export const PATROL_STREETS: ReadonlySet<string> = new Set(["pedestrian", "living_street"]);

/**
 * The room a facade takes beyond its outline round the patrols' band (m), on top of the planner's
 * margin. What sticks out further (brackets 0.95 + 0.42 m, banners 1.0 + 0.53 m, flat awnings 1.3 m)
 * hangs under or over the band where the lanes run: the glitch scan, flying the patrols through the
 * drawn facades (`drone-low-clearance`), meets one at 0.4 m and none at 1.0 m.
 */
export const FACADE_ROOM = 1.0;
/** A building's masts with their warning lights on its superstructure's last tier (ADR-0051: 3 + 6 m). */
const MAST = 9;
/** A utility pole's top (its model is 7.5 to 10 m, ADR-0063). */
const POLE_TOP = 10;
/** Buildings this near a pedestrian street are framed for their spans (m): the widest span and a margin. */
const FRAME_NEAR = 40;
/** A cable's radius as a post (m): the thickest is 0.07 m. */
const CABLE_R = 0.05;
/** The glazed box of a footbridge over its floor (m, `canyon-plan.ts`). */
const FOOTBRIDGE_H = 2.8;

type Item = { readonly view: ViewDescriptor; readonly at: Vec3 };

/** A piece's reach round its foot and its top over it (m): its model's and its solid's. */
const envelopes = new Map<string, { r: number; top: number }>();
const modelEnvelope = (kind: StreetPropKind, shape: number): { r: number; top: number } => {
  const key = `${kind}:${shape}`;
  let e = envelopes.get(key);
  if (!e) {
    const pos = propModel(kind, shape).sink.positions;
    let r = 0;
    let top = 0;
    for (let i = 0; i < pos.length; i += 3) {
      r = Math.max(r, Math.hypot(pos[i] as number, pos[i + 2] as number));
      top = Math.max(top, pos[i + 1] as number);
    }
    e = { r, top };
    envelopes.set(key, e);
  }
  return e;
};

/** The street furniture as posts, the poles and the cables between them (as the city strings each block's poles). */
const furniturePosts = (items: readonly Item[]): AirPost[] => {
  const posts: AirPost[] = [];
  const poles = new Map<string, WorldProp[]>();
  for (const { view, at } of items) {
    if (view.kind !== "street-props") continue;
    for (const item of view.items) {
      // The still crowd stands under the patrols and the decals are flat on the walls and the paving.
      if (item.prop === "figure" || DECAL_KINDS.has(item.prop)) continue;
      const w = toWorld([item], at)[0] as WorldProp;
      if (isPoleLamp(w)) {
        posts.push({ x: w.x, z: w.z, r: POLE_REACH, bottom: w.y, top: w.y + POLE_TOP });
        const k = cellKey(w.x, w.z, PROP_BLOCK);
        poles.set(k, [...(poles.get(k) ?? []), w]);
        continue;
      }
      const m = modelEnvelope(w.prop, w.shape);
      const solid = solidEnvelope(item);
      posts.push({ x: w.x, z: w.z, r: Math.max(m.r * w.scale, solid.r), bottom: w.y, top: w.y + Math.max(m.top * w.scale, solid.top) });
    }
  }
  for (const list of poles.values()) {
    for (const [a, b] of polePairs(list)) {
      const span = Math.hypot(b.x - a.x, b.z - a.z);
      for (const [p, q] of poleCables(a, b)) posts.push(...runPosts((t) => cablePoint({ a: p, b: q, sag: 0.25 + 0.03 * span }, t), span, CABLE_R, 0));
    }
  }
  return posts;
};

/** A piece's solid of the simulation round its foot (its CC-BY model is fitted into it). */
const solidEnvelope = (item: StreetPropItem): { r: number; top: number } => {
  let r = 0;
  let top = 0;
  for (const p of furniturePrisms(item)) {
    top = Math.max(top, p.top);
    for (const q of p.points) r = Math.max(r, Math.hypot(q.x, q.z));
  }
  return { r, top };
};

/** The buildings' solids and what hangs over the streets between them near the given axes. */
const buildingAir = (items: readonly Item[], axes: readonly (readonly P2[])[]): { prisms: AirPrism[]; posts: AirPost[] } => {
  const entries = new MapEntries();
  const prisms: AirPrism[] = [];
  const posts: AirPost[] = [];
  items.forEach(({ view, at }, i) => {
    if (view.kind !== "building") return;
    const ring = cleanRing(view.outline.map((p) => ({ x: p.x + at.x, z: p.z + at.z })));
    if (ring.length < 3) return;
    entries.addBuilding(SCENERY_ID_BASE + i, { ring, view, at, base: at.y, bounds: boundsOf(ring), cell: "", landmark: landmarkAt(at.x, at.z, view.outline.length) });
    const top = at.y + view.height + Math.max(0, view.vertical?.rise ?? 0) + Math.max(0, view.roof ?? 0) + (view.vertical ? MAST : 0);
    prisms.push({ ring, bottom: at.y + (view.soffit ?? 0), top, pad: FACADE_ROOM });
  });
  const near = new Set<number>();
  for (const line of axes) for (const p of line) for (const id of entries.buildingIndex.within({ minX: p.x - FRAME_NEAR, maxX: p.x + FRAME_NEAR, minZ: p.z - FRAME_NEAR, maxZ: p.z + FRAME_NEAR })) near.add(id);
  for (const id of [...near].sort((a, b) => a - b)) {
    const e = entries.buildings.get(id);
    if (!e) continue;
    const f = withLandmark(facadeFrame(entries.building(id, e), entries.neighbourAt, entries.neighboursNear), e.landmark);
    if (isLandmarkFrame(f)) {
      for (const r of cableRuns(f)) posts.push(...runPosts((t) => cablePoint(r, t), Math.hypot(r.b.x - r.a.x, r.b.z - r.a.z), CABLE_R, 0));
      continue;
    }
    for (const s of findSpans(f, entries.acrossAt)) {
      for (const c of spanCables(s, false)) posts.push(...runPosts((t) => cablePoint(c, t), Math.hypot(c.b.x - c.a.x, c.b.z - c.a.z), CABLE_R, c.lanterns ? LANTERN_DROP : 0));
      const across = { x: (s.b.x - s.a.x) / s.width, z: (s.b.z - s.a.z) / s.width };
      const mid = { x: (s.a.x + s.b.x) / 2, z: (s.a.z + s.b.z) / 2 };
      const bb = spanBillboard(s);
      // The board, its frame 0.3 m over it, and the cables it hangs from up to the walls.
      if (bb) prisms.push({ ring: boxRing(mid, across, s.width / 2, 0.15), bottom: bb.c.y - bb.h / 2 - 0.15, top: bb.c.y + bb.h / 2 + 2.6, pad: 0 });
      const fb = spanFootbridge(s);
      if (fb) prisms.push({ ring: fb.ring, bottom: fb.y, top: fb.y + FOOTBRIDGE_H, pad: 0 });
      const cu = spanCurtain(s, false);
      if (cu) {
        const c = { x: s.a.x + across.x * ((cu.from + cu.to) / 2) + s.along.x * cu.off, z: s.a.z + across.z * ((cu.from + cu.to) / 2) + s.along.z * cu.off };
        prisms.push({ ring: boxRing(c, across, (cu.to - cu.from) / 2 + 0.1, 0.1), bottom: cu.y - CURTAIN_DROP, top: cu.y, pad: 0 });
      }
    }
  }
  return { prisms, posts };
};

/** The low patrols' world from views and where they stand, and the pedestrian streets' axes. */
export const patrolWorldOf = (items: readonly Item[], axes: readonly (readonly P2[])[], groundAt: (x: number, z: number) => number | null, quietAt: (x: number, z: number) => boolean, surfaceAt: (x: number, z: number) => number): PatrolWorld => {
  const roads: P2[][] = [];
  for (const { view, at } of items) {
    if (view.kind !== "ground" || !DRONE_SURFACES.has(view.surface)) continue;
    const ring = worldRing(view.outline, at);
    if (ring.length >= 3) roads.push(ring);
  }
  const built = buildingAir(items, axes);
  const air = new PatrolAir(built.prisms, [...built.posts, ...furniturePosts(items)]);
  return { axes, roads, air, groundAt, quietAt, surfaceAt };
};

/** The Old Town keeps its calm (ADR-0058): the patrols come down over it now and then. */
export const quietAt = (x: number, z: number): boolean => chunkAt(x, z)?.district === "kanal";

let city: PatrolWorld | null = null;

/** Lublin as the low patrols see it, once: the whole scenery, the pedestrian streets' axes and the terrain. */
export const cityPatrolWorld = (): PatrolWorld => (city ??= patrolWorldOf(WORLD_SCENERY, streetAxes(LUBLIN_CHUNKS, PATROL_STREETS), groundY, quietAt, surfaceY));
