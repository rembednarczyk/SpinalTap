import { METRO_ENTRANCES } from "@seki/sim";
import { DRESS_FLAG, type MeshSink, type Rgba, hexColor } from "../mesh-sink";
import type { Box2 } from "../mapcity/polygon";

/**
 * The metro's pavilions (ADR-0071 stage 2) baked into the street furniture's block meshes
 * (ADR-0050): no draw call of their own. The simulation holds their blocks as solids drawn by the
 * scenery (`scenery`), and this draws them plainly from the same content: concrete under the
 * street and as the plinth, glass above it, the roof, the stairs step by step, the gates and the
 * ticket machine with its lit screen. Stage 3 dresses them.
 */

const COLOR: Readonly<Record<"concrete" | "glass" | "metal" | "asphalt", Rgba>> = {
  concrete: hexColor("#77797c"),
  // Wet: the panes catch the street lights like the asphalt does.
  glass: hexColor("#4f6b7d", DRESS_FLAG.wet),
  metal: hexColor("#3b3f46"),
  asphalt: hexColor("#3a3d45"),
};
const STEP: Rgba = hexColor("#8b8a86");
const SCREEN: Rgba = hexColor("#36c5ff", DRESS_FLAG.lit);

type Entrance = (typeof METRO_ENTRANCES)[number];

const inside = (b: Box2, x: number, z: number): boolean => x >= b.minX && x < b.maxX && z >= b.minZ && z < b.maxZ;

/** One entrance's blocks, the stairs as their steps (as `buildSteps` draws a slope). */
export const bakePavilion = (sink: MeshSink, e: Entrance): void => {
  for (const p of e.props) {
    const v = p.view;
    if (v.kind !== "block") continue;
    const c = p.center;
    const s = v.slope;
    if (!s?.steps) {
      sink.box(c, v.size.x, v.size.y, v.size.z, COLOR[v.material]);
      continue;
    }
    const along = s.axis === "x" ? v.size.x : v.size.z;
    const run = along / s.steps;
    for (let i = 0; i < s.steps; i++) {
      const t = (i + 0.5) / s.steps;
      const h = Math.max(0.02, s.low + (v.size.y - s.low) * t);
      const local = (s.dir === 1 ? t - 0.5 : 0.5 - t) * along;
      const y = c.y - v.size.y / 2 + h / 2;
      if (s.axis === "x") sink.box({ x: c.x + local, y, z: c.z }, run, h, v.size.z, STEP, { bottom: false });
      else sink.box({ x: c.x, y, z: c.z + local }, v.size.x, h, run, STEP, { bottom: false });
    }
  }
  // The ticket machine, its screen on the side towards the stairs.
  const m = e.machine;
  const size = e.machineSize;
  sink.box({ x: m.x, y: m.y + size.y / 2, z: m.z }, size.x, size.y, size.z, COLOR.metal, { bottom: false });
  const fx = Math.sin(e.machineYaw);
  const fz = Math.cos(e.machineYaw);
  const depth = Math.abs(fx) > 0.5 ? size.x : size.z;
  const across = Math.abs(fx) > 0.5 ? size.z : size.x;
  const screen = { x: m.x + fx * (depth / 2 + 0.01), y: m.y + 1.2, z: m.z + fz * (depth / 2 + 0.01) };
  sink.box(screen, Math.abs(fx) > 0.5 ? 0.02 : across * 0.6, 0.35, Math.abs(fx) > 0.5 ? across * 0.6 : 0.02, SCREEN);
};

/** The far stand-in: the box, the roof and the dark opening, a handful of triangles. */
export const bakePavilionFar = (sink: MeshSink, e: Entrance): void => {
  const o = e.outline;
  const top = e.street + 3.1;
  sink.box({ x: (o.minX + o.maxX) / 2, y: (e.street + top) / 2, z: (o.minZ + o.maxZ) / 2 }, o.maxX - o.minX, top - e.street, o.maxZ - o.minZ, COLOR.glass, { bottom: false });
  sink.box({ x: (o.minX + o.maxX) / 2, y: top + 0.1, z: (o.minZ + o.maxZ) / 2 }, o.maxX - o.minX + 1.2, 0.2, o.maxZ - o.minZ + 1.2, COLOR.concrete);
};

/** The pavilions whose middle lies in a block of the street furniture. */
export const pavilionsIn = (bounds: Box2, entrances: readonly Entrance[] = METRO_ENTRANCES): Entrance[] => entrances.filter((e) => inside(bounds, e.spot.x, e.spot.z));
