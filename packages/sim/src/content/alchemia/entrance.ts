import { groundY } from "../lublin/terrain";
import { L1_TOP, L2_SLABS } from "./front";
import { MAIN_DOORS, MAIN_WAY_X, MALL, MALL_LEVELS } from "./mall-plan";
import { P1_RAMP } from "./parking";
import { type Piece, box, piece } from "./plan";

/*
 * The light that leads in by the main entrance (ADR-0093 O2b, `docs/zasady-lokacji.md` §4: green is
 * for ways and doors, the way always lit brighter than round it). Pattern: the wayfinding of a
 * shopping mall's entrance (a lit portal at the end of a straight approach, the "desire line" of
 * urban design paved and lit, so the way in reads from the street). Drawn only, flat on the ground,
 * under L2's soffit or on the glass: nothing of it at the body's height stands out of a face.
 * - Two dashed strips of light in the paving, the way's edges, from Bajkowskiego's footway to the doors.
 * - One along L2's soffit over the way's middle, where L2 covers it.
 * - A dashed strip across the ground over the ramp's covered part, from the passage west of the ramp
 *   (the arcade's way north) east to the main way: the way in from under the arcade.
 * - The doors' portal: green jambs and lintel on the glass round the opening, a screen over it.
 */

/** The way's edges in the paving: 3.6 m apart, inside its 4.5 m between the ramp's bed and P-1's stair house. */
const EDGES = [MAIN_WAY_X - 1.8, MAIN_WAY_X + 1.8] as const;
/** From the footway's edge (the ramp's top) to a step before the doors' glass. */
const WAY = { z0: P1_RAMP.top + 0.3, z1: MALL.z0 - 0.4 } as const;
/** A dash and the gap after it, along the way. */
const DASH = 1.2;
const EVERY = 2;
/** A strip's width and how far it stands out of the paving (the import's setts lie on the terrain). */
const STRIP = 0.12;
const PROUD = 0.03;
/** L2's soffit's underside over the way, and the strip under it. */
const SOFFIT = L1_TOP - 0.35;
/** The crossing from the passage west of the ramp over its covered part, on this line. */
const CROSS = { x0: 405, z: P1_RAMP.covered + 1.4 } as const;

const cm = (v: number): number => Math.round(v * 100) / 100;

/** A strip from `a` to `b` along x or z on the ground, its top `PROUD` over the highest ground along it. */
const groundStrip = (x0: number, x1: number, z0: number, z1: number): Piece => {
  const g = [groundY(x0, z0), groundY(x1, z0), groundY(x0, z1), groundY(x1, z1)];
  return piece(box(x0, x1, z0, z1, cm(Math.min(...g) - 0.02), cm(Math.max(...g) + PROUD)), "led-green", false, false);
};

/** The way's two dashed edges in the paving. */
const edges = (): Piece[] =>
  EDGES.flatMap((x) => {
    const out: Piece[] = [];
    for (let z = WAY.z0; z + DASH <= WAY.z1 + 1e-6; z += EVERY) out.push(groundStrip(x - STRIP / 2, x + STRIP / 2, z, z + DASH));
    return out;
  });

/** The dashed crossing from the passage west of the ramp over its covered part to the way's west edge. */
const crossing = (): Piece[] => {
  const out: Piece[] = [];
  for (let x = CROSS.x0; x + DASH <= EDGES[0] + 1e-6; x += EVERY) out.push(groundStrip(x, x + DASH, CROSS.z - STRIP / 2, CROSS.z + STRIP / 2));
  return out;
};

/** The strip along L2's soffit over the way's middle, from its south edge to the gallery's glass. */
const soffit = (): Piece[] => {
  const z0 = L2_SLABS[0]!.minZ + 0.4;
  return [piece(box(MAIN_WAY_X - 0.06, MAIN_WAY_X + 0.06, z0, MALL.z0 - 0.3, SOFFIT - 0.05, SOFFIT), "led-green", false, false)];
};

/** The doors' portal on the glass's outer face: green jambs and lintel round the opening, the screen over it. */
const portal = (): Piece[] => {
  const d = MAIN_DOORS;
  const y = MALL_LEVELS.p1;
  const top = y + 2.3;
  const face = { z0: MALL.z0 - 0.06, z1: MALL.z0 } as const;
  return [
    piece(box(d.x0 - 0.25, d.x0 - 0.1, face.z0, face.z1, y, top + 0.1), "led-green", false, false),
    piece(box(d.x1 + 0.1, d.x1 + 0.25, face.z0, face.z1, y, top + 0.1), "led-green", false, false),
    piece(box(d.x0 - 0.25, d.x1 + 0.25, face.z0, face.z1, top + 0.1, top + 0.25), "led-green", false, false),
    piece(box(d.x0 + 0.3, d.x1 - 0.3, face.z0, face.z1, top + 0.45, SOFFIT - 0.25), "screen", false, false),
  ];
};

/** The main entrance's light: drawn with the front (none of it solid). */
export const entrancePieces = (): Piece[] => [...edges(), ...crossing(), ...soffit(), ...portal()];
