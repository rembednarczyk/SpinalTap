import type { Rectangle } from "./rounded";
import type { ShopDef } from "./shops-plan";

/*
 * The units of the front's storeys (ADR-0093 O5): the gallery's in-line units (O2's pattern: a
 * shopfront on the arcade with its door, partitions, a back room, a fascia with a proper name in neon)
 * along the arcades of L1's west wing, L2 and L3, and one on the street in L1's east wing. Kept clear of
 * the rounded corners of the glass (the arcs' squares stay arcade or a sealed services' corner), a
 * quarter of them shut, barred or to let. TOKYO DRIP, shut, moved here from P2's south strip, where
 * the passage to L2 runs now (its id and its place among the gallery's units kept, `shops-plan.ts`).
 */

const r = (x0: number, x1: number, z0: number, z1: number): Rectangle => ({ x0, x1, z0, z1 });

/** L1's west wing: its arcade along the east glass (x 400.2-403.8), the units west of it facing it. */
const L1: readonly ShopDef[] = [
  { id: "l1-1", floor: "l1", rect: r(394.2, 400.2, 2.8, 8.4), front: "e", trade: "clothing", state: "open", sign: "NIGHT SILK" },
  { id: "l1-2", floor: "l1", rect: r(394.2, 400.2, 8.4, 12.3), front: "e", trade: "repair", state: "vacant", sign: "" },
  // Its back on the narrower north part's glass from z 14; south of it a sealed corner behind a wall.
  { id: "l1-3", floor: "l1", rect: r(396.2, 400.2, 12.3, 20.6), front: "e", trade: "pharmacy", state: "open", sign: "FARMA PLUS", back: true },
  { id: "l1-4", floor: "l1", rect: r(396.2, 400.2, 20.6, 25.7), front: "e", trade: "tattoo", state: "open", sign: "BLACK LOTUS", door: "r" },
];

/** L1's east wing: one unit on the street east, its door in the glass by the walk from the stair house to Lubartowska. */
const L1E: readonly ShopDef[] = [{ id: "l1e-1", floor: "l1e", rect: r(427.9, 435.8, 15.2, 20.8), front: "e", trade: "synth-food", state: "open", sign: "KONBINI", street: true }];

/**
 * L2: along its cross arcade (z 17.6-21.6) a row south of it (its backs on the café's wall) and a row
 * north of it (its backs on the gallery's glass), either side of the spine (x 416.6-421.8) from the
 * gallery's door south to the glass over the square.
 */
const L2: readonly ShopDef[] = [
  { id: "l2-s1", floor: "l2", rect: r(394.2, 400.0, 10.7, 17.6), front: "n", trade: "electronics", state: "open", sign: "CYBERDECK", back: true },
  { id: "l2-s2", floor: "l2", rect: r(400.0, 405.6, 10.7, 17.6), front: "n", trade: "vr", state: "grille", sign: "NEUROVIA", back: true, door: "r" },
  { id: "l2-s3", floor: "l2", rect: r(405.6, 411.1, 10.7, 17.6), front: "n", trade: "implants", state: "open", sign: "SYNAPSE", back: true },
  { id: "l2-s4", floor: "l2", rect: r(411.1, 416.6, 10.7, 17.6), front: "n", trade: "crypto", state: "open", sign: "BITBANK", back: true, door: "r" },
  // Short of the rounded north-west corner, a wall across its back.
  { id: "l2-n1", floor: "l2", rect: r(394.2, 400.0, 21.6, 30.3), front: "s", trade: "clothing", state: "open", sign: "SHIBUYA", back: true },
  { id: "l2-n2", floor: "l2", rect: r(400.0, 405.6, 21.6, 32.0), front: "s", trade: "pawn", state: "vacant", sign: "", door: "r" },
  { id: "l2-n3", floor: "l2", rect: r(405.6, 411.1, 21.6, 32.0), front: "s", trade: "florist", state: "open", sign: "BONSAI" },
  { id: "l2-n5", floor: "l2", rect: r(421.8, 428.8, 21.6, 32.0), front: "s", trade: "arms", state: "open", sign: "OKAMI ARMS" },
  { id: "l2-n6", floor: "l2", rect: r(428.8, 435.8, 21.6, 32.0), front: "s", trade: "repair", state: "open", sign: "DATAFIX", door: "r" },
];

/** L3, the food hall's floor: two units on its west side facing the dining room, past its rounded corners. */
const L3: readonly ShopDef[] = [
  { id: "l3-w1", floor: "l3", rect: r(398.2, 406.1, 17.6, 23.8), front: "e", trade: "synth-food", state: "open", sign: "NOODLE BOX" },
  { id: "l3-w2", floor: "l3", rect: r(398.2, 406.1, 23.8, 30.0), front: "e", trade: "vr", state: "open", sign: "ARCADIA", door: "r" },
];

/** TOKYO DRIP's unit on L2 (ADR-0093 O5), between BONSAI and the spine: its def stays among the gallery's (`shops-plan.ts`). */
export const TOKYO_DRIP_L2: Rectangle = r(411.1, 416.6, 21.6, 32.0);

/** Every unit of the front but TOKYO DRIP, after the gallery's in `ALCHEMIA_PROPS`. */
export const FRONT_SHOPS: readonly ShopDef[] = [...L1, ...L1E, ...L2, ...L3];
