import { type CityKitData, type GeometrySink, swatchUv } from "../city-kit-data";
import type { Vec } from "../mesh-sink";
import { BLADE_HALF, BOARD_HALF, DEPTAK_SIGNS, type DeptakSign, TENEMENT_WALLS, along, onWall, outOf } from "./deptak-signs";

/*
 * The bodies of the deptak's neons (ADR-0074 C7) in the tiers' mesh, on the city kit's material, as
 * the front's lightbox (`front-sign-geometry.ts`): an upright blade's dark box on two brackets out
 * of the wall, a board's lit red box (the kit's red glow) under a bar out of the wall. The light over
 * them (rims, letters) is the signs' mesh (`deptak-signs.ts`).
 */

const UP: Vec = { x: 0, y: 1, z: 0 };
/** A bracket's half side, and how far it reaches into the wall. */
const ARM = 0.035;
const INTO = 0.05;

/** A box `[along, up, out]` of a wall's frame: centred `c`, its half extents. */
const box = (sink: GeometrySink, data: CityKitData, wall: 0 | 1, c: Vec, half: readonly [number, number, number], swatch: string): void => {
  const w = TENEMENT_WALLS[wall];
  sink.box(c, [along(w), UP, outOf(w)], half, swatchUv(data, swatch));
};

/** The point `out` metres out of a sign's wall at its `z`, `y` high. */
const at = (s: DeptakSign, out: number, y: number): Vec => {
  const w = TENEMENT_WALLS[s.wall];
  const [p, o] = [onWall(w, s.z), outOf(w)];
  return { x: p.x + o.x * out, y, z: p.z + o.z * out };
};

/** A bracket from the wall out to `out`, `y` high. */
const arm = (sink: GeometrySink, data: CityKitData, s: DeptakSign, out: number, y: number): void =>
  box(sink, data, s.wall, at(s, (out - INTO) / 2, y), [ARM, ARM, (out + INTO) / 2], "metal");

/** One sign's body. */
const body = (sink: GeometrySink, data: CityKitData, s: DeptakSign): void => {
  const mid = (s.y0 + s.y1) / 2;
  const h = (s.y1 - s.y0) / 2;
  const [o0, o1] = s.out;
  if (s.kind === "blade") {
    box(sink, data, s.wall, at(s, (o0 + o1) / 2, mid), [BLADE_HALF, h, (o1 - o0) / 2], "dark");
    arm(sink, data, s, o0 + 0.1, s.y1 - 0.25);
    arm(sink, data, s, o0 + 0.1, s.y0 + 0.25);
    return;
  }
  box(sink, data, s.wall, at(s, (o0 + o1) / 2, mid), [BOARD_HALF, h, (o1 - o0) / 2], "neon-red");
  // Hung from a bar out of the wall over its whole length.
  arm(sink, data, s, o1, s.y1 + ARM + 0.02);
};

/** The deptak's neons' bodies, into the tiers' sink. */
export const deptakSignGeometry = (sink: GeometrySink, data: CityKitData): void => {
  for (const s of DEPTAK_SIGNS) body(sink, data, s);
};
