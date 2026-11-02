import { readFileSync } from "node:fs";
import type { Vec3, ViewDescriptor } from "../../../packages/core/src";
import { type CityProps, mergeCityProps, parseCityProps } from "../../../packages/engine/src/renderer/city-props";
import { findSpans, planNearCanyon } from "../../../packages/engine/src/renderer/mapcity/canyon-plan";
import { planCanyonSigns } from "../../../packages/engine/src/renderer/mapcity/canyon-signs";
import { planNearFrames } from "../../../packages/engine/src/renderer/mapcity/cell-plan";
import { facadeFrame } from "../../../packages/engine/src/renderer/mapcity/facade-frame";
import { type PropSlot, bakeSlots } from "../../../packages/engine/src/renderer/mapcity/facade-props";
import { landmarkAt, withLandmark } from "../../../packages/engine/src/renderer/mapcity/landmarks";
import { MapEntries } from "../../../packages/engine/src/renderer/mapcity/map-entries";
import { cellKey } from "../../../packages/engine/src/renderer/mapcity/map-index";
import { type Box2, boundsOf, cleanRing } from "../../../packages/engine/src/renderer/mapcity/polygon";
import { toWorld } from "../../../packages/engine/src/renderer/mapcity/prop-batch";
import { type PropBlock, nearSink, newBlock } from "../../../packages/engine/src/renderer/mapcity/prop-block";
import { standingObstacles } from "../../../packages/engine/src/renderer/mapcity/prop-obstacles";
import { PropPoles } from "../../../packages/engine/src/renderer/mapcity/prop-poles";
import { PROP_BLOCK } from "../../../packages/engine/src/renderer/mapcity/prop-shapes";
import { MAP_SIGN_KIND, planBuildingSigns } from "../../../packages/engine/src/renderer/mapcity/sign-plan";
import { isPoleLamp } from "../../../packages/engine/src/renderer/mapcity/utility-poles";
import { planVenueSigns } from "../../../packages/engine/src/renderer/mapcity/venue-plan";
import { MeshSink } from "../../../packages/engine/src/renderer/mesh-sink";
import { SCENERY_ID_BASE } from "../../../packages/sim/src/presentation/render-sync";

/**
 * The drawn geometry round the low patrols' lanes (ADR-0058 stage 7b), as the map city draws it on
 * `high` with its props files: the detailed facades with their props, signs and landmarks, the
 * layer over the streets (cables, lanterns, billboards, footbridges, curtains) and the street
 * furniture's detailed blocks (lamps, trees, parasols, stalls, poles and their cables). The light
 * that is not a solid (the billboards' beams, the canyon mist, the reflections in the paving) is
 * left out. Triangles in 4 m bins, each with what drew it.
 */

export interface AirMesh {
  /** Triangles near a box: their corners (9 numbers each) and what drew them. */
  near(box: Box2, bottom: number, top: number): { readonly tri: Float32Array; readonly what: string }[];
  readonly triangles: number;
}

type Item = { readonly view: ViewDescriptor; readonly at: Vec3 };

const BIN = 4;
/** Sign kinds that are light, not a solid. */
const LIGHT: ReadonlySet<number> = new Set([MAP_SIGN_KIND.beam, MAP_SIGN_KIND.mist, MAP_SIGN_KIND.reflection]);

const file = (name: string): ArrayBuffer => {
  const b = readFileSync(new URL(`../../../packages/app/public/city/${name}`, import.meta.url));
  return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer;
};

/** The props files the near city bakes from (the still crowd left out: the patrols fly over the heads). */
export const scanProps = (): CityProps => ["street-props.glb", "market-props.glb", "door-props.glb"].reduce((a, n) => mergeCityProps(a, parseCityProps(file(n))), parseCityProps(file("city-props.glb")));

const meets = (a: Box2, b: Box2): boolean => a.minX <= b.maxX && a.maxX >= b.minX && a.minZ <= b.maxZ && a.maxZ >= b.minZ;

/** The geometry of the scenery within `zones` (the lanes' boxes with a margin). */
export const airMesh = (items: readonly Item[], zones: readonly Box2[], props: CityProps = scanProps()): AirMesh => {
  const inZone = (b: Box2) => zones.some((z) => meets(z, b));
  const entries = new MapEntries();
  const blocks = new Map<string, PropBlock>();
  items.forEach(({ view, at }, i) => {
    const id = SCENERY_ID_BASE + i;
    if (view.kind === "terrain") {
      const g = view.grid;
      entries.terrains.set(id, { grid: g, open: view.open, bounds: { minX: g.originX, maxX: g.originX + (g.cols - 1) * g.cell, minZ: g.originZ, maxZ: g.originZ + (g.rows - 1) * g.cell }, mesh: null });
    } else if (view.kind === "street-props") {
      for (const w of toWorld(view.items, at)) {
        const p = isPoleLamp(w) ? { ...w, pole: true } : w;
        const k = cellKey(p.x, p.z, PROP_BLOCK);
        const block = blocks.get(k) ?? newBlock(k);
        blocks.set(k, block);
        block.pieces.set(id, [...(block.pieces.get(id) ?? []), p]);
      }
    } else if (view.kind === "building" || view.kind === "ground") {
      const ring = cleanRing(view.outline.map((p) => ({ x: p.x + at.x, z: p.z + at.z })));
      if (ring.length < 3) return;
      if (view.kind === "building") entries.addBuilding(id, { ring, view, at, base: at.y, bounds: boundsOf(ring), cell: "", landmark: landmarkAt(at.x, at.z, view.outline.length) });
      else entries.addGround(id, { surface: view.surface, ring, y: at.y, bounds: boundsOf(ring), cell: "", ...(view.deck ? { deck: view.deck } : {}) });
    }
  });
  const poles = new PropPoles("high");
  poles.setProps(props);
  const sinks: { sink: MeshSink; what: string; signs?: boolean }[] = [];
  for (const [key, block] of blocks) if (inZone(block.bounds)) sinks.push({ sink: nearSink({ quality: "high", poles }, block), what: `furniture block ${key}` });
  const obstacles = (x: number, z: number, r: number) => standingObstacles(blocks, poles, x, z, r);
  const ids = [...entries.buildings.keys()].filter((id) => inZone(entries.buildings.get(id)!.bounds)).sort((a, b) => a - b);
  const frames = ids.map((id) => {
    const e = entries.buildings.get(id)!;
    return withLandmark(facadeFrame(entries.building(id, e), entries.neighbourAt, entries.neighboursNear), e.landmark);
  });
  frames.forEach((f, k) => {
    const sink = new MeshSink();
    const slots: PropSlot[] = [];
    planNearFrames(sink, [f], false, (s) => slots.push(s) > 0, obstacles);
    bakeSlots(sink, props, slots, false);
    const spans = findSpans(f, entries.acrossAt);
    planNearCanyon(sink, spans, false);
    sinks.push({ sink, what: `building ${ids[k]} and its spans` });
    const signs = new MeshSink();
    planBuildingSigns(signs, f, () => null, entries.drawnGround);
    planVenueSigns(signs, f, entries.drawnGround, false);
    planCanyonSigns(signs, [f], spans, false);
    sinks.push({ sink: signs, what: `signs of building ${ids[k]}`, signs: true });
  });
  const tris: { tri: Float32Array; what: string; box: Box2; bottom: number; top: number }[] = [];
  const bins = new Map<string, number[]>();
  for (const { sink, what, signs } of sinks) {
    const pos = sink.positions;
    for (let t = 0; t + 2 < sink.indices.length; t += 3) {
      const v = [sink.indices[t]!, sink.indices[t + 1]!, sink.indices[t + 2]!];
      if (signs && LIGHT.has(sink.uvs2[v[0]! * 2 + 1]!)) continue;
      const tri = new Float32Array(9);
      v.forEach((i, k) => tri.set([pos[i * 3]!, pos[i * 3 + 1]!, pos[i * 3 + 2]!], k * 3));
      const box = { minX: Math.min(tri[0]!, tri[3]!, tri[6]!), maxX: Math.max(tri[0]!, tri[3]!, tri[6]!), minZ: Math.min(tri[2]!, tri[5]!, tri[8]!), maxZ: Math.max(tri[2]!, tri[5]!, tri[8]!) };
      if (!inZone(box)) continue;
      const n = tris.push({ tri, what, box, bottom: Math.min(tri[1]!, tri[4]!, tri[7]!), top: Math.max(tri[1]!, tri[4]!, tri[7]!) }) - 1;
      for (let i = Math.floor(box.minX / BIN); i <= Math.floor(box.maxX / BIN); i++) {
        for (let j = Math.floor(box.minZ / BIN); j <= Math.floor(box.maxZ / BIN); j++) {
          const k = `${i}:${j}`;
          const list = bins.get(k);
          if (list) list.push(n);
          else bins.set(k, [n]);
        }
      }
    }
  }
  return {
    triangles: tris.length,
    near: (box, bottom, top) => {
      const seen = new Set<number>();
      for (let i = Math.floor(box.minX / BIN); i <= Math.floor(box.maxX / BIN); i++) {
        for (let j = Math.floor(box.minZ / BIN); j <= Math.floor(box.maxZ / BIN); j++) for (const n of bins.get(`${i}:${j}`) ?? []) seen.add(n);
      }
      return [...seen].map((n) => tris[n]!).filter((t) => t.bottom <= top && t.top >= bottom && meets(t.box, box));
    },
  };
};
