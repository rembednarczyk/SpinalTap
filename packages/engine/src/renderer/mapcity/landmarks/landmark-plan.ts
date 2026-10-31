import type { MeshSink, Rgba } from "../../mesh-sink";
import { type FacadeFrame, type Wall, trimMeta } from "../facade-frame";
import { band } from "../facade-parts";
import { doorwaysOn, walls } from "../facade-plan";
import { WINDOW_STYLE } from "../facade-style";
import { planPassages } from "../passage-plan";
import { SWATCH, archPanel, blindNiches, clockFace, cornice, helmet, lit, pilasters, shownWalls, skirtRoof, slabRing, solid, stonePlinth } from "./kit";
import { GALLERY, type WallRect, battlements, buttress, clearOfPassages, diaper, gallery, paintingNiche, plaqueRow, smallWindows } from "./elevation";
import { camera, corniceLights, facing, helmLeds, mast, scanner, screenFrame, sideOf, uplightFittings } from "./layer2077";
import { courseAndKeystones, dataRoof, gableTrim, rustication, stringCourse, windowRows } from "./classicist";
import type { LandmarkFrame } from "./landmark-frame";
import type { LandmarkPart, Material, PartRecipe, Tier } from "./recipes";

/**
 * A landmark's building or part from its recipe (ADR-0062), in place of the facade plan: the
 * walls, plinth, blinds, pilasters, cornices, crown and Lublin 2077's layer near, the solid with
 * its crown and the lit elements far. Neither the window grid, the roofs, the superstructures
 * (ADR-0051) nor the procedural church towers touch it.
 */

export type { LandmarkFrame };

const WALL: Readonly<Record<Material, string>> = { brick: SWATCH.brick, plaster: SWATCH.plaster, stone: SWATCH.stone };
const TRIM: Readonly<Record<Material, string>> = { brick: SWATCH.brickDark, plaster: SWATCH.plasterTrim, stone: SWATCH.stone };

/** A tier's wall colour: its plaster's colour when the data gives one, else its material's. */
const wallOf = (t: Tier): string => (t.colour ? SWATCH[t.colour] : WALL[t.material]);

/**
 * The frame of a map building turned into a landmark's: plain walls (no window bays) up to the
 * top, which a helmet shorter than the data's roof raises: the peak stays the data's.
 */
export const landmarkFrame = (f: FacadeFrame, landmark: LandmarkPart): LandmarkFrame => {
  const t = landmark.part.tier;
  const c = landmark.part.crown;
  const roof = f.b.roof ?? 0;
  const lift = c.kind === "helm" && roof > c.height ? roof - c.height : 0;
  return {
    ...f,
    b: lift > 0 ? { ...f.b, roof: roof - lift } : f.b,
    landmark,
    style: { ...f.style, plaster: wallOf(t), trim: TRIM[t.material], plinth: SWATCH.stone, window: WINDOW_STYLE.none, shopfront: false, attic: "none", atticHeight: 0, cornice: false, stringCourse: false, roof: c.kind === "roof" ? f.style.roof : "flat", tower: false, freeTower: false, neonTrim: null, signs: 0 },
    walls: f.walls.map((w) => ({ ...w, bay: 0 })),
    top: f.top + lift,
    eave: f.top + lift,
  };
};

/** The frame, as a landmark's when the building has a recipe. */
export const withLandmark = (f: FacadeFrame, landmark: LandmarkPart | null): FacadeFrame => (landmark ? landmarkFrame(f, landmark) : f);

export const isLandmarkFrame = (f: FacadeFrame): f is LandmarkFrame => "landmark" in f;

/** The widest of the shown walls facing a direction (within ~30°), else the one facing it most squarely, or null. */
export const mostFacing = (f: FacadeFrame, dir: { x: number; z: number }): Wall | null => {
  const score = (w: Wall) => (facing(w, dir) > 0.85 ? 10 + w.length : facing(w, dir));
  let best: Wall | null = null;
  for (const w of shownWalls(f)) if (!best || score(w) > score(best)) best = w;
  return best;
};

/** A passage's mouth on a wall: the wall, the mouth along it, its top and the street's floor at it (world y). */
export interface Mouth {
  readonly w: Wall;
  readonly u0: number;
  readonly u1: number;
  readonly top: number;
  readonly ground: number;
}

/** The floor of the passage's end nearest (x, z), else the lowest ground under the building. */
const floorAt = (f: LandmarkFrame, x: number, z: number): number => {
  let best = { d: Infinity, y: f.b.foot };
  for (const p of f.b.passages ?? []) {
    for (const [q, y] of [
      [p.from, p.floor[0]],
      [p.to, p.floor[1]],
    ] as const) {
      const d = Math.hypot(q.x - x, q.z - z);
      if (d < best.d) best = { d, y };
    }
  }
  return best.y;
};

/** The first shown wall on a side with a passage's mouth in it, with the mouth along it. */
export const mouthWall = (f: LandmarkFrame, side: "new" | "old"): Mouth | null => {
  const layer = f.landmark.recipe.layer;
  for (const w of shownWalls(f)) {
    if (sideOf(w, layer) !== side) continue;
    const o = doorwaysOn(w, f.b.doorways ?? [])[0];
    if (!o) continue;
    const t = (o.u0 + o.u1) / 2 / w.length;
    return { w, u0: o.u0, u1: o.u1, top: o.top, ground: floorAt(f, w.a.x + (w.b.x - w.a.x) * t, w.a.z + (w.b.z - w.a.z) * t) };
  }
  return null;
};

/** The mouths with uplights: the Old Town's, and the new town's too where the whole layer is subdued. */
export const litMouths = (f: LandmarkFrame): Mouth[] => (f.landmark.recipe.layer.subdued ? (["old", "new"] as const) : (["old"] as const)).flatMap((s) => mouthWall(f, s) ?? []);

/** Where the clocks are: the walls facing the new town and the Old Town. */
export const clockWalls = (f: LandmarkFrame): { neon: Wall | null; old: Wall | null } => {
  const d = f.landmark.recipe.layer.newTown;
  return { neon: mostFacing(f, d), old: mostFacing(f, { x: -d.x, z: -d.z }) };
};

/** Bottom and top of a tier's lower zone (the whole wall for one zone), clear of the gallery's door. */
export const lowerZone = (f: LandmarkFrame): [number, number] => {
  const t = f.landmark.part.tier;
  return [f.b.foot + (t.gallery ? GALLERY.floor + GALLERY.door + 0.05 : 0.45), t.split ? f.b.foot + t.split - 0.2 : f.top - 0.6];
};

/** Height and radius of a clock on a tier: in its lower zone. */
export const clockSpot = (f: LandmarkFrame, w: Wall): { y: number; r: number } => {
  const [y0, y1] = lowerZone(f);
  return { y: (y0 + y1) / 2, r: Math.max(0.4, Math.min(w.length * 0.36, (y1 - y0) * 0.5)) };
};

/** Clocks, arched openings (round-headed over a split, on every wall), the string course and the gallery of a tier. */
const faces = (sink: MeshSink, f: LandmarkFrame, part: PartRecipe): void => {
  const meta = trimMeta(f.style.seed);
  const t = part.tier;
  const { neon, old } = t.clock ? clockWalls(f) : { neon: null, old: null };
  if (neon) {
    const c = clockSpot(f, neon);
    clockFace(sink, neon, neon.length / 2, c.y, c.r, solid("#10151c"), lit("#5ce1ff"), meta);
  }
  if (old) {
    const c = clockSpot(f, old);
    clockFace(sink, old, old.length / 2, c.y, c.r, solid("#efe6cf"), solid("#1b1d22"), meta);
  }
  if (t.split) band(sink, f.b.ring, 0.12, f.b.foot + t.split - 0.12, f.b.foot + t.split + 0.1, solid(SWATCH.plasterTrim), meta, f.b.base);
  if (t.gallery && neon) gallery(sink, f, neon, solid(SWATCH.plasterTrim), solid(SWATCH.opening));
  if (!t.openings) return;
  const y0 = t.split ? f.b.foot + t.split + 0.3 : f.b.foot + 0.7;
  for (const w of shownWalls(f)) {
    if ((!t.split && (w === neon || w === old)) || w.length < 1.2) continue;
    archPanel(sink, w, w.length / 2, Math.min(w.length * 0.36, 0.8), y0, f.top - 0.75, 0.03, solid(SWATCH.opening), meta, false);
  }
};

/** The crown of a part, near or far; returns nothing, the helmet's lit layer included. */
const crown = (sink: MeshSink, f: LandmarkFrame, part: PartRecipe, near: boolean): void => {
  const c = part.crown;
  const roof = f.b.roof ?? 0;
  const meta = trimMeta(f.style.seed);
  if (c.kind === "crenel" && near) {
    battlements(sink, f, c.merlon, c.pitch, solid(wallOf(part.tier)), solid(SWATCH.stone));
    return;
  }
  if (c.kind === "flat" || c.kind === "crenel") {
    slabRing(sink, f.b.ring, f.top, solid(c.kind === "flat" ? SWATCH.tile : SWATCH.stone), meta);
    if (near) band(sink, f.b.ring, 0.1, f.top - 0.22, f.top + 0.05, solid(TRIM[part.tier.material]), meta, f.b.base);
    return;
  }
  if (c.kind === "skirt") {
    skirtRoof(sink, f, Math.min(c.rise, roof || c.rise), c.inset, solid(SWATCH.tile));
    return;
  }
  if (c.kind === "roof") {
    dataRoof(sink, f, solid(wallOf(part.tier)), solid(TRIM[part.tier.material]), near);
    return;
  }
  if (roof <= 0.5) {
    slabRing(sink, f.b.ring, f.top, solid(SWATCH.patina), meta);
    return;
  }
  const layer = f.landmark.recipe.layer;
  const base = helmet(sink, f, c.profile, roof, solid(SWATCH.patina), solid(SWATCH.plasterTrim), near);
  helmLeds(sink, f, base, c.profile, roof, layer);
  if (near) mast(sink, base.c, f.top + roof * c.profile.mast, f.top + roof, base.phase);
  else sink.box({ x: base.c.x, y: f.top + roof - 0.15, z: base.c.z }, 0.3, 0.3, 0.3, lit("#ff2a2a"));
};

/** Top of a part's walls: under the merlons of battlements, else the top. */
const wallTop = (f: LandmarkFrame): number => (f.landmark.part.crown.kind === "crenel" ? f.top - f.landmark.part.crown.merlon : f.top);

/** Lublin 2077's lit geometry on the walls: cornice lines, the screen's frame, the camera, uplights, the scanner. */
const layerOn = (sink: MeshSink, f: LandmarkFrame, part: PartRecipe): void => {
  const layer = f.landmark.recipe.layer;
  const meta = trimMeta(f.style.seed);
  const t = part.tier;
  if (t.cornice) corniceLights(sink, f, f.top - 0.44, 0.33, layer);
  else if (part.crown.kind === "crenel") corniceLights(sink, f, wallTop(f) - 0.12, 0.03, layer);
  // On the string course between two zones, else on the base moulding.
  if (t.split) corniceLights(sink, f, f.b.foot + t.split - 0.01, 0.13, layer);
  else if (t.front) corniceLights(sink, f, stringCourse(f) + 0.2, 0.15, layer);
  else if (t.base) corniceLights(sink, f, f.b.foot + 0.42, 0.2, layer);
  const s = screenOn(f);
  if (s) screenFrame(sink, s.w, s.u, s.y, s.width, s.height, meta);
  const old = mouthWall(f, "old");
  // Beside the arch's head on a classicist front, off its windows over the string course.
  if (old) camera(sink, old.w, cameraAlong(old), old.top + (t.front ? -0.6 : 1.1));
  for (const m of litMouths(f)) uplightFittings(sink, m.w, m.ground, uplightsOn(m), layer.warm, meta);
  if (layer.checkpoint) for (const p of f.b.passages ?? []) scanner(sink, f, p, "#5ce1ff");
};

/**
 * How high over the tier's foot the screen starts: seen from the plaza over the merlons standing
 * 8 m in front of the tower (over the 10 m annex an eye 18 m from them sees the wall from 4 m up).
 */
const SCREEN_OVER = 4;

/** The screen's place and size: on the wall of a `screen` tier facing the new town, centred, over the battlements in front of it (T-034). */
export const screenOn = (f: LandmarkFrame): (WallRect & { u: number; y: number; width: number; height: number }) | null => {
  const layer = f.landmark.recipe.layer;
  const w = f.landmark.part.tier.screen && layer.screen ? mostFacing(f, layer.newTown) : null;
  if (!w) return null;
  const height = Math.min(1.4, f.top - f.b.foot - SCREEN_OVER - 1.2);
  const width = Math.min(height * 2.6, w.length - 0.8);
  if (height < 0.6 || width < 1.2) return null;
  const y = f.b.foot + SCREEN_OVER + height / 2;
  const u = w.length / 2;
  return { w, u, y, width, height, u0: u - width / 2 - 0.12, u1: u + width / 2 + 0.12, y0: y - height / 2 - 0.12, y1: y + height / 2 + 0.12 };
};

/** Where the camera hangs along the Old Town's mouth wall: past the mouth's end, before its start when the corner is too near. */
export const cameraAlong = (m: Mouth): number => (m.u1 + 0.9 <= m.w.length - 0.8 ? m.u1 + 0.9 : Math.max(m.u0 - 0.9, 0.4));

/** Where the uplights stand along a mouth's wall: either side of the mouth, moved in off the corners, where there is room. */
export const uplightsOn = (m: { w: Wall; u0: number; u1: number }): number[] =>
  [m.u0 - 1.1, m.u1 + 1.1].map((u) => Math.min(Math.max(u, 0.5), m.w.length - 0.5)).filter((u) => u < m.u0 - 0.4 || u > m.u1 + 0.4);

/** The battered buttresses' walls: the new town's side walls with no mouth (the corner blocks) and the short walls by them. */
export const buttressWalls = (f: LandmarkFrame): Wall[] => {
  const layer = f.landmark.recipe.layer;
  const ws = f.walls;
  const open = (w: Wall) => (f.b.doorways?.length ? doorwaysOn(w, f.b.doorways).length > 0 : false);
  const out = new Set<Wall>();
  ws.forEach((w, i) => {
    if (sideOf(w, layer) !== "new" || open(w) || w.blind) return;
    out.add(w);
    for (const n of [ws[(i + ws.length - 1) % ws.length], ws[(i + 1) % ws.length]]) if (n && n.length < 3 && !open(n) && !n.blind) out.add(n);
  });
  return [...out];
};

/** The brick elevation of a tier: zendrówki, small windows, the panels under the battlements, buttresses and the painting's niche (T-033). */
const brickwork = (sink: MeshSink, f: LandmarkFrame, t: Tier): void => {
  const top = wallTop(f) - (t.cornice ? 0.6 : 0.05);
  const from = f.b.lifted ? f.b.foot : f.b.foot - 0.2;
  if (t.diaper) for (const w of shownWalls(f)) diaper(sink, f, w, from, top, solid(SWATCH.header));
  if (t.windows) smallWindows(sink, f, t.windows, f.b.foot + 0.6, top, screenOn(f), solid(SWATCH.stone), solid(SWATCH.opening));
  const layer = f.landmark.recipe.layer;
  const stone = t.buttress ? buttressWalls(f) : [];
  // Over the buttresses' tops only: under them the battered stone would bury the panels.
  for (const y of t.plaques ?? []) plaqueRow(sink, f, f.b.foot + y, (w) => sideOf(w, layer) !== "old" && (y > (t.buttress ?? 0) + 0.3 || !stone.includes(w)), solid(SWATCH.plasterTrim));
  for (const w of stone) for (const [u0, u1] of clearOfPassages(f, w, 0.45)) buttress(sink, f, w, u0, u1, t.buttress ?? 0, 0.45, solid(SWATCH.stone));
  const n = t.niche;
  const m = n ? mouthWall(f, "new") : null;
  if (n && m) paintingNiche(sink, f, m.w, (m.u0 + m.u1) / 2, f.b.foot + n.from, Math.min(f.b.foot + n.to, wallTop(f) - 0.2), n.width, solid(SWATCH.stone), solid(SWATCH.picture), solid(SWATCH.figure));
};

/** A classicist front: rustication up to the string course with the keystones, the windows over it, the gable's trim. */
const classicFront = (sink: MeshSink, f: LandmarkFrame, front: NonNullable<Tier["front"]>, trim: Rgba): void => {
  const course = stringCourse(f);
  rustication(sink, f, course, solid(f.landmark.part.tier.colour ? SWATCH.beigeJoint : SWATCH.niche));
  courseAndKeystones(sink, f, course, trim);
  windowRows(sink, f, front.rows, front.windows, course + 0.35, f.top - 0.7, trim, solid(SWATCH.opening));
  if (f.landmark.part.crown.kind === "roof") gableTrim(sink, f, trim, solid(SWATCH.opening));
};

/** The detailed landmark part for the near cells. */
export const planNearLandmark = (sink: MeshSink, f: LandmarkFrame): void => {
  const part = f.landmark.part;
  const t = part.tier;
  const wall = solid(wallOf(t));
  const trim = solid(TRIM[t.material]);
  walls(sink, f, wallTop(f), wall);
  const y0 = f.b.lifted ? f.b.foot : f.b.base;
  const y1 = t.cornice ? f.top - 0.6 : f.top;
  if (t.plinth > 0 && !f.b.lifted) stonePlinth(sink, f, f.b.base + t.plinth, solid(SWATCH.stone));
  if (t.blinds.length > 0) blindNiches(sink, f, t.blinds, y0 + (t.plinth > 0 ? t.plinth + 0.3 : 0.2), y1, solid(SWATCH.niche));
  // On a classicist front from the string course up, over the rustication.
  if (t.pilasters) pilasters(sink, f, t.front ? stringCourse(f) + 0.24 : f.b.foot + (t.base ? 0.35 : 0), f.top - 0.55, solid(SWATCH.plasterTrim));
  if (t.base) band(sink, f.b.ring, 0.16, f.b.foot - 0.02, f.b.foot + 0.35, trim, trimMeta(f.style.seed), f.b.base);
  if (t.cornice) cornice(sink, f, f.b.ring, f.top, trim);
  if (t.material === "brick") brickwork(sink, f, t);
  if (t.front) classicFront(sink, f, t.front, trim);
  faces(sink, f, part);
  crown(sink, f, part, true);
  layerOn(sink, f, part);
  planPassages(sink, f);
};

/** The landmark part for the far cells: the solid in its material, its crown and the lit elements. */
export const planFarLandmark = (sink: MeshSink, f: LandmarkFrame): void => {
  const part = f.landmark.part;
  walls(sink, f, f.top, solid(wallOf(part.tier)));
  crown(sink, f, part, false);
  if (part.tier.cornice && part.tier.material === "plaster") corniceLights(sink, f, f.top - 0.44, 0.05, f.landmark.recipe.layer);
  planPassages(sink, f);
};
