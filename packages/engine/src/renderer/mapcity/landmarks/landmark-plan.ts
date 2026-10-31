import type { MeshSink } from "../../mesh-sink";
import { type FacadeFrame, type Wall, trimMeta } from "../facade-frame";
import { band } from "../facade-parts";
import { doorwaysOn, walls } from "../facade-plan";
import { WINDOW_STYLE } from "../facade-style";
import { planPassages } from "../passage-plan";
import { SWATCH, archPanel, blindNiches, clockFace, cornice, helmet, lit, pilasters, shownWalls, skirtRoof, slabRing, solid, stonePlinth } from "./kit";
import { camera, corniceLights, facing, helmLeds, mast, scanner, screenFrame, sideOf, uplightFittings } from "./layer2077";
import type { LandmarkPart, Material, PartRecipe } from "./recipes";

/**
 * A landmark's building or part from its recipe (ADR-0062), in place of the facade plan: the
 * walls, plinth, blinds, pilasters, cornices, crown and Lublin 2077's layer near, the solid with
 * its crown and the lit elements far. Neither the window grid, the roofs, the superstructures
 * (ADR-0051) nor the procedural church towers touch it.
 */

/** A facade frame of a landmark: its recipe part, and a style with no windows, shops or roof of its own. */
export interface LandmarkFrame extends FacadeFrame {
  readonly landmark: LandmarkPart;
}

const WALL: Readonly<Record<Material, string>> = { brick: SWATCH.brick, plaster: SWATCH.plaster, stone: SWATCH.stone };
const TRIM: Readonly<Record<Material, string>> = { brick: SWATCH.brickDark, plaster: SWATCH.plasterTrim, stone: SWATCH.stone };

/** The frame of a map building turned into a landmark's: plain walls (no window bays) up to the top. */
export const landmarkFrame = (f: FacadeFrame, landmark: LandmarkPart): LandmarkFrame => {
  const m = landmark.part.tier.material;
  return {
    ...f,
    landmark,
    style: { ...f.style, plaster: WALL[m], trim: TRIM[m], plinth: SWATCH.stone, window: WINDOW_STYLE.none, shopfront: false, attic: "none", atticHeight: 0, cornice: false, stringCourse: false, roof: "flat", tower: false, freeTower: false, neonTrim: null, signs: 0 },
    walls: f.walls.map((w) => ({ ...w, bay: 0 })),
    eave: f.top,
  };
};

/** The frame, as a landmark's when the building has a recipe. */
export const withLandmark = (f: FacadeFrame, landmark: LandmarkPart | null): FacadeFrame => (landmark ? landmarkFrame(f, landmark) : f);

export const isLandmarkFrame = (f: FacadeFrame): f is LandmarkFrame => "landmark" in f;

/** The wall facing a direction most squarely among the shown ones, or null. */
const mostFacing = (f: FacadeFrame, dir: { x: number; z: number }): Wall | null => {
  let best: Wall | null = null;
  for (const w of shownWalls(f)) if (!best || facing(w, dir) > facing(best, dir)) best = w;
  return best;
};

/** The first shown wall on a side with a passage's mouth in it, with the mouth along it. */
export const mouthWall = (f: LandmarkFrame, side: "new" | "old"): { w: Wall; u0: number; u1: number; top: number } | null => {
  const layer = f.landmark.recipe.layer;
  for (const w of shownWalls(f)) {
    if (sideOf(w, layer) !== side) continue;
    const o = doorwaysOn(w, f.b.doorways ?? [])[0];
    if (o) return { w, u0: o.u0, u1: o.u1, top: o.top };
  }
  return null;
};

/** Where the clocks are: the walls facing the new town and the Old Town most squarely. */
const clockWalls = (f: LandmarkFrame): { neon: Wall | null; old: Wall | null } => {
  const d = f.landmark.recipe.layer.newTown;
  return { neon: mostFacing(f, d), old: mostFacing(f, { x: -d.x, z: -d.z }) };
};

/** Height and radius of a clock on a tier. */
export const clockSpot = (f: FacadeFrame, w: Wall): { y: number; r: number } => {
  const y0 = f.b.foot + 0.45;
  const y1 = f.top - 0.6;
  return { y: (y0 + y1) / 2, r: Math.max(0.4, Math.min(w.length * 0.36, (y1 - y0) * 0.36)) };
};

/** Clocks and arched openings of a tier (a belfry, a lantern storey). */
const faces = (sink: MeshSink, f: LandmarkFrame, part: PartRecipe): void => {
  const meta = trimMeta(f.style.seed);
  const { neon, old } = part.tier.clock ? clockWalls(f) : { neon: null, old: null };
  if (neon) {
    const c = clockSpot(f, neon);
    clockFace(sink, neon, neon.length / 2, c.y, c.r, solid("#10151c"), lit("#5ce1ff"), meta);
  }
  if (old) {
    const c = clockSpot(f, old);
    clockFace(sink, old, old.length / 2, c.y, c.r, solid("#efe6cf"), solid("#1b1d22"), meta);
  }
  if (!part.tier.openings) return;
  for (const w of shownWalls(f)) {
    if (w === neon || w === old || w.length < 1.2) continue;
    archPanel(sink, w, w.length / 2, Math.min(w.length * 0.36, 0.85), f.b.foot + 0.7, f.top - 0.9, 0.03, solid(SWATCH.opening), meta, false);
  }
};

/** The crown of a part, near or far; returns nothing, the helmet's lit layer included. */
const crown = (sink: MeshSink, f: LandmarkFrame, part: PartRecipe, near: boolean): void => {
  const c = part.crown;
  const roof = f.b.roof ?? 0;
  const meta = trimMeta(f.style.seed);
  if (c.kind === "flat") {
    slabRing(sink, f.b.ring, f.top, solid(SWATCH.tile), meta);
    if (near) band(sink, f.b.ring, 0.1, f.top - 0.22, f.top + 0.05, solid(TRIM[part.tier.material]), meta, f.b.base);
    return;
  }
  if (c.kind === "skirt") {
    skirtRoof(sink, f, Math.min(c.rise, roof || c.rise), c.inset, solid(SWATCH.tile));
    return;
  }
  if (roof <= 0.5) {
    slabRing(sink, f.b.ring, f.top, solid(SWATCH.helm), meta);
    return;
  }
  const layer = f.landmark.recipe.layer;
  const base = helmet(sink, f, c.profile, roof, solid(SWATCH.helm), solid(SWATCH.plasterTrim), near);
  helmLeds(sink, f, base, c.profile, roof, layer);
  if (near) mast(sink, base.c, f.top + roof * c.profile.mast, f.top + roof, base.phase);
  else sink.box({ x: base.c.x, y: f.top + roof - 0.15, z: base.c.z }, 0.3, 0.3, 0.3, lit("#ff2a2a"));
};

/** Lublin 2077's lit geometry on the walls: cornice lines, the screen's frame, the camera, uplights, the scanner. */
const layerOn = (sink: MeshSink, f: LandmarkFrame, part: PartRecipe): void => {
  const layer = f.landmark.recipe.layer;
  const meta = trimMeta(f.style.seed);
  if (part.tier.cornice) corniceLights(sink, f, f.top - 0.44, 0.33, layer);
  if (part.tier.base) corniceLights(sink, f, f.b.foot + 0.42, 0.2, layer);
  const fresh = mouthWall(f, "new");
  if (fresh && layer.screen) {
    const s = screenSpot(f, fresh);
    if (s) screenFrame(sink, fresh.w, s.u, s.y, s.width, s.height, meta);
  }
  const old = mouthWall(f, "old");
  if (old) {
    camera(sink, old.w, Math.min(old.u1 + 0.9, old.w.length - 0.4), old.top + 1.1);
    uplightFittings(sink, f, old.w, uplightsOn(old), layer.warm);
  }
  if (layer.checkpoint) for (const p of f.b.passages ?? []) scanner(sink, f, p, "#5ce1ff");
};

/** The screen over a mouth: centred over it, between the arch's crown and the cornice. */
export const screenSpot = (f: FacadeFrame, m: { w: Wall; u0: number; u1: number; top: number }): { u: number; y: number; width: number; height: number } | null => {
  const y0 = m.top + 0.45;
  const y1 = f.top - 0.85;
  if (y1 - y0 < 0.6) return null;
  const height = Math.min(y1 - y0, 1.7);
  return { u: (m.u0 + m.u1) / 2, y: (y0 + y1) / 2, width: Math.min(m.u1 - m.u0 + 1.4, height * 3, m.w.length - 0.4), height };
};

/** Where the uplights stand along the Old Town's mouth wall: either side of the mouth. */
export const uplightsOn = (m: { w: Wall; u0: number; u1: number }): number[] => [m.u0 - 1.1, m.u1 + 1.1].filter((u) => u > 0.4 && u < m.w.length - 0.4);

/** The detailed landmark part for the near cells. */
export const planNearLandmark = (sink: MeshSink, f: LandmarkFrame): void => {
  const part = f.landmark.part;
  const t = part.tier;
  const wall = solid(WALL[t.material]);
  const trim = solid(TRIM[t.material]);
  walls(sink, f, f.top, wall);
  const y0 = f.b.lifted ? f.b.foot : f.b.base;
  const y1 = t.cornice ? f.top - 0.6 : f.top;
  if (t.plinth > 0 && !f.b.lifted) stonePlinth(sink, f, f.b.base + t.plinth, solid(SWATCH.stone));
  if (t.blinds.length > 0) blindNiches(sink, f, t.blinds, y0 + (t.plinth > 0 ? t.plinth + 0.3 : 0.2), y1, solid(SWATCH.niche));
  if (t.pilasters) pilasters(sink, f, f.b.foot + (t.base ? 0.35 : 0), f.top - 0.55, solid(SWATCH.plasterTrim));
  if (t.base) band(sink, f.b.ring, 0.16, f.b.foot - 0.02, f.b.foot + 0.35, trim, trimMeta(f.style.seed), f.b.base);
  if (t.cornice) cornice(sink, f, f.b.ring, f.top, trim);
  faces(sink, f, part);
  crown(sink, f, part, true);
  layerOn(sink, f, part);
  planPassages(sink, f);
};

/** The landmark part for the far cells: the solid in its material, its crown and the lit elements. */
export const planFarLandmark = (sink: MeshSink, f: LandmarkFrame): void => {
  const part = f.landmark.part;
  walls(sink, f, f.top, solid(WALL[part.tier.material]));
  crown(sink, f, part, false);
  if (part.tier.cornice && part.tier.material === "plaster") corniceLights(sink, f, f.top - 0.44, 0.05, f.landmark.recipe.layer);
  planPassages(sink, f);
};
