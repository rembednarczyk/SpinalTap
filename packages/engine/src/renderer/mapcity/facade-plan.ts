import { prng } from "../city-kit-data";
import { DRESS_FLAG, type MeshSink, type Rgba, hexColor } from "../mesh-sink";
import { type FacadeFrame, type Palette, frameWallMeta, hiddenWall, roofMeta, trimMeta } from "./facade-frame";
import { band, slab, wallQuad } from "./facade-parts";
import { WINDOW_STYLE } from "./facade-style";
import { type P2, offsetRing } from "./polygon";
import { addDome, addHipRoof, addTowers } from "./roof-plan";


/**
 * Geometry of a map building (ADR-0044), baked in world space into the cell's sinks:
 * - near: walls (windows, shop fronts and plaster painted by the facade shader from the UVs),
 *   plinth, string course, main cornice, attic or crenellated parapet, roof (hipped, flat or a
 *   dome) and church towers;
 * - far: one block per building with the same wall encoding and a flat top, towers as boxes.
 *
 * Wall encoding (facade shader): uv = (metres along the wall, metres above the ground floor),
 * uv2 = `wallMeta`; colour rgb = plaster, a = dressing flag (1 painted, 0 self-lit).
 */


/** Parapet walls inside the outline from `from` to `top`, a cap on them and the roof slab inside. */
const parapet = (sink: MeshSink, f: FacadeFrame, from: number, colors: { wall: Rgba; trim: Rgba; roof: Rgba }): readonly P2[] => {
  const ring = f.b.ring;
  const inner = offsetRing(ring, -0.3);
  if (!inner) {
    slab(sink, ring, f.top, colors.roof, roofMeta(f.style.seed));
    return ring;
  }
  const meta = trimMeta(f.style.seed);
  for (let i = 0; i < inner.length; i++) {
    const a = inner[i] as P2;
    const b = inner[(i + 1) % inner.length] as P2;
    const len = Math.hypot(b.x - a.x, b.z - a.z) || 1;
    // Facing into the roof: the inward normal.
    wallQuad(sink, a, b, { x: -(b.z - a.z) / len, z: (b.x - a.x) / len }, from, f.top, f.b.base, colors.wall, meta);
  }
  band(sink, inner, 0.3, f.top - 0.02, f.top + 0.12, colors.trim, meta, f.b.base);
  slab(sink, inner, from, colors.roof, roofMeta(f.style.seed));
  return inner;
};

/** Merlons along the parapet of the Old Town attics (Renaissance crenellation). */
const merlons = (sink: MeshSink, f: FacadeFrame, color: Rgba): void => {
  const rand = prng((f.b.look ^ 0xc4e7) >>> 0);
  const w = 0.6 + rand() * 0.3;
  const h = 0.55 + rand() * 0.4;
  const step = w * 2.1;
  for (const wall of f.walls) {
    if (hiddenWall(f, wall) || wall.length < step) continue;
    const dx = (wall.b.x - wall.a.x) / wall.length;
    const dz = (wall.b.z - wall.a.z) / wall.length;
    const count = Math.floor(wall.length / step);
    const start = (wall.length - (count - 1) * step) / 2;
    for (let k = 0; k < count; k++) {
      const u = start + k * step;
      const c = { x: wall.a.x + dx * u - wall.nx * 0.15, y: f.top + 0.12 + h / 2, z: wall.a.z + dz * u - wall.nz * 0.15 };
      sink.box(c, w, h, 0.34, color, { rotY: Math.atan2(-dz, dx), bottom: false });
    }
  }
};

const paletteOf = (f: FacadeFrame): Palette => ({
  wall: hexColor(f.style.plaster, DRESS_FLAG.solid),
  trim: hexColor(f.style.trim, DRESS_FLAG.solid),
  plinth: hexColor(f.style.plinth, DRESS_FLAG.solid),
  roof: hexColor(f.style.roofColor, DRESS_FLAG.solid),
});

/** Walls from the foot of the slope to `to`, skipping those a neighbour hides completely. */
const walls = (sink: MeshSink, f: FacadeFrame, to: number, color: Rgba): void => {
  for (const w of f.walls) {
    if (hiddenWall(f, w)) continue;
    wallQuad(sink, w.a, w.b, { x: w.nx, z: w.nz }, f.b.foot - 0.2, to, f.b.base, color, frameWallMeta(f, w));
  }
};

/** Attic face above the cornice: plain plaster, no windows. */
const atticFaces = (sink: MeshSink, f: FacadeFrame, color: Rgba): void => {
  for (const w of f.walls) {
    if (hiddenWall(f, w)) continue;
    wallQuad(sink, w.a, w.b, { x: w.nx, z: w.nz }, f.eave, f.top, f.b.base, color, trimMeta(f.style.seed));
  }
};

/** The detailed building for the near cells. */
export const planNearBuilding = (sink: MeshSink, f: FacadeFrame): void => {
  const p = paletteOf(f);
  const s = f.style;
  const b = f.b;
  const ring = b.ring;
  const trim = trimMeta(s.seed);
  walls(sink, f, f.eave, p.wall);
  if (f.top > f.eave + 0.01) atticFaces(sink, f, p.wall);
  // Plinth: dark stone around the foot, up to the window sills of the ground floor.
  band(sink, ring, 0.06, b.foot - 0.2, b.base + 0.55, p.plinth, trim, b.base);
  if (s.stringCourse && f.ground + 0.6 < f.eave - b.base) band(sink, ring, 0.12, b.base + f.ground, b.base + f.ground + 0.22, p.trim, trim, b.base);
  if (s.cornice) {
    band(sink, ring, 0.18, f.eave - 0.55, f.eave - 0.3, p.trim, trim, b.base);
    band(sink, ring, 0.42, f.eave - 0.3, f.eave, p.trim, trim, b.base);
  }
  if (s.window === WINDOW_STYLE.block) band(sink, ring, 0.08, f.top - 0.1, f.top + 0.15, p.trim, trim, b.base);
  roofOf(sink, f, p);
  if (s.tower) addTowers(sink, f, p, true);
};

const roofOf = (sink: MeshSink, f: FacadeFrame, p: Palette): void => {
  const s = f.style;
  const roof = f.b.roof ?? 0;
  if (s.roof === "hip" && roof > 0.3) {
    if (s.attic !== "none") parapet(sink, f, f.top - 0.4, p);
    addHipRoof(sink, f, roof, p.roof, p.trim);
    return;
  }
  if (s.attic === "none") {
    slab(sink, f.b.ring, f.top, p.roof, roofMeta(s.seed));
  } else {
    parapet(sink, f, f.top - Math.min(s.atticHeight, 1.2), p);
    if (s.attic === "crenel") merlons(sink, f, p.trim);
  }
  if (s.roof === "dome" && roof > 0.3) addDome(sink, f, roof, p.roof, p.wall);
};

/** One block per building for the far cells: same walls, a flat top, towers as boxes. */
export const planFarBuilding = (sink: MeshSink, f: FacadeFrame): void => {
  const p = paletteOf(f);
  const top = f.top + (f.b.roof ?? 0) * 0.35;
  walls(sink, f, top, p.wall);
  slab(sink, f.b.ring, top, p.roof, roofMeta(f.style.seed));
  if (f.style.tower) addTowers(sink, f, p, false);
};
