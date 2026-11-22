import { MALL_LEVELS, STAIR_CORES, type StairCore } from "./mall-plan";
import { type Piece, box, piece } from "./plan";

/*
 * The way out lit in green (the user's rule of 22.11, `docs/zasady-lokacji.md` §13, functional contrast:
 * the doors one leaves by stand out of the room in the navigation's colour, as an evacuation sign does,
 * ISO 7010 E001): a green sign over the door of each stair core on every floor the core opens onto, on the
 * door's face to the floor. Drawn only; the renderer hangs a green light by each (`alchemia-lights.ts`).
 */

/** The door's head over its floor (`mall-cores.ts`: 2.1 m) and the sign over it. */
const SIGN = { from: 2.18, to: 2.4, inset: 0.15, depth: 0.05 } as const;

/** Where a core's door faces the floor at height `f`: its sign's box. */
const signOf = (c: StairCore, f: number): Piece => {
  const [a0, a1] = [c.door.a0 + SIGN.inset, c.door.a1 - SIGN.inset];
  const [y0, y1] = [f + SIGN.from, f + SIGN.to];
  // The north door's face is the core's north wall's outer side (z1 + the wall), the west one's its west wall's outer side.
  const b = c.door.side === "n" ? box(a0, a1, c.z1 + 0.2, c.z1 + 0.2 + SIGN.depth, y0, y1) : box(c.x0 - 0.2 - SIGN.depth, c.x0 - 0.2, a0, a1, y0, y1);
  return piece(b, "led-green", true, false);
};

/** The floors each core's door opens onto with a room before it: under the roof (the roof's door leads outside). */
export const EXIT_FLOORS = (c: StairCore): readonly number[] => c.floors.filter((f) => f < MALL_LEVELS.roof - 0.01);

/** Every exit sign of the gallery's cores. */
export const EXIT_SIGNS: readonly Piece[] = STAIR_CORES.flatMap((c) => EXIT_FLOORS(c).map((f) => signOf(c, f)));
