import { prng } from "../city-kit-data";
import { DRESS_FLAG, type MeshSink, type Vec, hexColor } from "../mesh-sink";
import type { FacadeFrame, Wall } from "./facade-frame";

/**
 * Hanging shop signs of the Old Town (ADR-0048, `stare-miasto.hanging-shop-signs` of the props
 * plan): a wrought-iron bracket out of the wall over the shop, with a round neon sign hung under
 * it, both faces readable from along the street. The bracket is part of the near facade; the
 * sign is drawn with the map signs (`planBuildingSigns`). Both read their places from
 * `bracketSpots`, a pure function of the building.
 */

/** How far the sign hangs out of the wall: from `SIGN_OUT - SIGN_RADIUS` to `SIGN_OUT + SIGN_RADIUS`. */
export const SIGN_OUT = 0.95;
export const SIGN_RADIUS = 0.42;
/** The bracket's arm reaches this far out of the wall. */
const ARM = 1.5;
const IRON = hexColor("#1d1a19", DRESS_FLAG.solid);

/** Where one bracket sign hangs: on `wall`, `u` metres from its start, the arm at height `y`. */
export interface BracketSpot {
  readonly wall: Wall;
  readonly u: number;
  /** World y of the arm; the sign's centre hangs `SIGN_RADIUS + 0.12` under it. */
  readonly y: number;
  /** Seed of the sign: its colour and its glyph. */
  readonly seed: number;
}

/** Street walls long enough for a sign, longest first. */
const streetWalls = (f: FacadeFrame): Wall[] =>
  f.walls
    .filter((w) => !w.blind && w.length >= 3)
    .slice()
    .sort((a, b) => b.length - a.length);

/** The bracket signs of a building: one or two on its street walls, over the ground floor. */
export const bracketSpots = (f: FacadeFrame): BracketSpot[] => {
  if (!f.b.bracketSigns || f.style.signs === 0 || !f.style.shopfront || f.b.lifted || (f.b.doorways?.length ?? 0) > 0) return [];
  const rand = prng((f.b.look ^ 0xb7ac) >>> 0);
  return streetWalls(f)
    .slice(0, f.style.signs)
    .map((wall) => {
      // Near one end of the wall, clear of the corner, like a shop's sign by its door.
      const end = rand() < 0.5;
      const u = Math.min(Math.max(1.2 + rand() * Math.min(2, wall.length * 0.3), 1), wall.length - 1);
      return { wall, u: end ? u : wall.length - u, y: f.b.base + Math.min(f.ground + 0.55, 5.2), seed: rand() };
    });
};

/** A point off the wall: `u` along it, `out` metres out of it, at height y. */
const off = (w: Wall, u: number, out: number, y: number): Vec => {
  const dx = (w.b.x - w.a.x) / w.length;
  const dz = (w.b.z - w.a.z) / w.length;
  return { x: w.a.x + dx * u + w.nx * out, y, z: w.a.z + dz * u + w.nz * out };
};

/** The iron of one bracket: wall plate, arm, brace under it, a curl at its end and the two hangers. */
const bracket = (sink: MeshSink, s: BracketSpot): void => {
  const w = s.wall;
  const rotY = Math.atan2(w.nx, w.nz);
  sink.box(off(w, s.u, 0.04, s.y - 0.2), 0.16, 0.6, 0.08, IRON, { rotY });
  sink.box(off(w, s.u, ARM / 2, s.y), 0.05, 0.06, ARM, IRON, { rotY });
  // The brace from the plate up to the middle of the arm.
  const brace = Math.hypot(ARM * 0.55, 0.45);
  // Local x along the outward normal, tilted up towards the arm.
  sink.box(off(w, s.u, (ARM * 0.55) / 2, s.y - 0.225), brace, 0.04, 0.04, IRON, { rotY: Math.atan2(-w.nz, w.nx), tilt: Math.atan2(0.45, ARM * 0.55) });
  sink.box(off(w, s.u, ARM - 0.06, s.y + 0.09), 0.05, 0.18, 0.05, IRON, { rotY });
  for (const k of [-1, 1]) sink.box(off(w, s.u, SIGN_OUT + k * SIGN_RADIUS * 0.7, s.y - 0.07), 0.025, 0.14, 0.025, IRON, { rotY });
};

/** The brackets of a building, for the near facade. */
export const planBrackets = (sink: MeshSink, f: FacadeFrame): void => {
  for (const s of bracketSpots(f)) bracket(sink, s);
};
