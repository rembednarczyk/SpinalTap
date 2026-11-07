import { groundY } from "../lublin/terrain";
import { P1_RAMP, P1_STAIR } from "./parking";
import { type Box, HALL, type Piece, box, piece } from "./plan";

/**
 * T0's square over P-1 and the food hall's green roof (ADR-0074 stage 7, decision 7.11): where the
 * car park's asphalt was, a square in the style of the deptak of Krakowskie Przedmieście. The import
 * lays its setts and lawns (`tools/osm-import`, T-241) and the deptak's pastoral lamps and benches
 * stand on it from the furniture's plan; this module is what the game builds on it:
 * - pergolas of dark timber with paper lanterns under their beams: one along the walk west of the
 *   ramp's trench from Bajkowskiego to the hall, one along the hall's back wall from the west ramp
 *   down to T1 to the hall's stair house, and one over the door of P-1's stair house, so the stair
 *   house stands in the square and not on it;
 * - beds of flowers along the trench's parapets, knee high (seats too; the east one narrower, by the
 *   walk from the ramp's top to the stair house), so the trench reads as the
 *   square's, not a hole in a car park;
 * - lawns on the hall's roof, its slab paved between them.
 * Posts and beds are solid, the beams, lanterns and lawns drawn only (the beams over every head).
 * They keep clear of the level graph's nodes and edges on T0 (`parking-nav.ts`, `nav.ts`), of the
 * people waiting on it (`market.ts`) and of the map's streets (`cut-on-road`).
 */

/** A pergola's post: its side, and how high its beams stand over the ground at its foot. */
const POST = 0.2;
const HEIGHT = 2.9;
const BEAM = 0.16;
/** The paper lanterns: a box this big, hanging this far under the beam. */
const LANTERN = 0.28;
const DROP = 0.55;

/** Rounded to the centimetre, as the simulation's other heights. */
const cm = (v: number): number => Math.round(v * 100) / 100;

/**
 * The walk along the trench's west parapet (pergola A): two rows of posts, the west at the lawn's
 * edge, the east in the bed along the parapet, a pair every 3 m from Bajkowskiego to P-1's apron.
 */
export const PERGOLA_WALK = { west: 404.0, east: P1_RAMP.minX - 0.3 - 0.4 - POST, from: -1.5, to: 22.5, every: 3 } as const;
/** Along the hall's back wall (pergola C): from the west ramp's head to past the hall's stair house. */
export const PERGOLA_BACK = { south: 26.5, north: 29.3, from: 396.4, to: 405.4, every: 3 } as const;
/** Over the door of P-1's stair house (pergola B): posts at its south end, its beams on the house's wall. */
export const PERGOLA_DOOR = { west: P1_STAIR.minX + 0.2, east: P1_STAIR.maxX + 0.2, south: 8.4, north: P1_STAIR.minZ } as const;

/** The beds along the trench's parapets: west the whole open length, east up to the stair house's approach. */
export const PARAPET_BEDS = [
  { x0: P1_RAMP.minX - 0.3 - 0.8, x1: P1_RAMP.minX - 0.3, z0: -3.5, z1: 11.5 },
  { x0: P1_RAMP.maxX + 0.3, x1: P1_RAMP.maxX + 0.3 + 0.5, z0: -3.5, z1: 8.0 },
] as const;
const BED_HEIGHT = 0.45;
const BED_STEP = 2;

/** The lawns on the hall's roof: four beds of grass either side of a cross of paths. */
export const ROOF_LAWNS: readonly Box[] = [402.5, 420].flatMap((x) => [37, 47.5].map((z) => box(x, x + 13.5, z, z + 7.5, HALL.roof, HALL.roof + 0.05)));

/** A post standing on the ground at (x, z), up to `top`. */
const post = (x: number, z: number, top: number): Piece => piece(box(x, x + POST, z, z + POST, cm(groundY(x, z) - 0.1), top), "pergola", false);

/** A lantern hanging under the beam at (x, z) whose underside is `under`. */
const lantern = (x: number, z: number, under: number): Piece =>
  piece(box(x - LANTERN / 2, x + LANTERN / 2, z - LANTERN / 2, z + LANTERN / 2, under - DROP - LANTERN, under - DROP), "lantern", false, false);

/** Pergola A: a pair of posts every 3 m, a crossbeam over each with a lantern, rails along both rows. */
const walkPergola = (): Piece[] => {
  const p = PERGOLA_WALK;
  const out: Piece[] = [];
  let last: { z: number; top: number } | null = null;
  for (let z = p.from; z <= p.to + 1e-6; z += p.every) {
    const top = cm(Math.max(groundY(p.west, z), groundY(p.east, z)) + HEIGHT);
    out.push(post(p.west, z, top), post(p.east, z, top));
    out.push(piece(box(p.west - 0.2, p.east + POST + 0.2, z, z + POST, top, top + BEAM), "pergola", false, false));
    out.push(lantern((p.west + p.east + POST) / 2, z + POST / 2, top));
    if (last) {
      // The rails between this pair and the last, at the lower of their crossbeams' tops, and a lantern between them.
      const y = Math.min(last.top, top) + BEAM;
      for (const x of [p.west, p.east]) out.push(piece(box(x, x + POST, last.z, z + POST, y, y + BEAM), "pergola", false, false));
      out.push(lantern((p.west + p.east + POST) / 2, (last.z + z) / 2, Math.min(last.top, top)));
    }
    last = { z, top };
  }
  return out;
};

/** Pergola C: pairs of posts across it every 3 m, crossbeams with a lantern, rails along it. */
const backPergola = (): Piece[] => {
  const p = PERGOLA_BACK;
  const out: Piece[] = [];
  const xs: number[] = [];
  for (let x = p.from; x <= p.to + 1e-6; x += p.every) xs.push(x);
  const top = cm(Math.max(...xs.flatMap((x) => [groundY(x, p.south), groundY(x, p.north)])) + HEIGHT);
  for (const x of xs) {
    out.push(post(x, p.south, top), post(x, p.north, top));
    out.push(piece(box(x, x + POST, p.south - 0.2, p.north + POST + 0.2, top, top + BEAM), "pergola", false, false));
    out.push(lantern(x + POST / 2, (p.south + p.north + POST) / 2, top));
  }
  for (const z of [p.south, p.north]) out.push(piece(box(p.from - 0.3, p.to + POST + 0.3, z, z + POST, top + BEAM, top + 2 * BEAM), "pergola", false, false));
  for (let i = 0; i + 1 < xs.length; i++) out.push(lantern((xs[i]! + xs[i + 1]! + POST) / 2, (p.south + p.north + POST) / 2, top + BEAM));
  return out;
};

/** Pergola B: two posts south of the stair house's door, beams from them to its wall, slats across, two lanterns. */
const doorPergola = (): Piece[] => {
  const p = PERGOLA_DOOR;
  const mid = (p.west + p.east) / 2;
  const top = cm(Math.max(groundY(mid, p.south), groundY(mid, p.north)) + HEIGHT);
  const out: Piece[] = [post(p.west, p.south, top), post(p.east, p.south, top)];
  for (const x of [p.west, p.east]) out.push(piece(box(x, x + POST, p.south, p.north, top, top + BEAM), "pergola", false, false));
  for (let z = p.south + 0.6; z < p.north - 0.1; z += 0.6) out.push(piece(box(p.west - 0.2, p.east + POST + 0.2, z, z + 0.08, top + BEAM, top + BEAM + 0.08), "pergola", false, false));
  out.push(piece(box(p.west - 0.2, p.east + POST + 0.2, p.south, p.south + POST, top + BEAM, top + 2 * BEAM), "pergola", false, false));
  for (const z of [p.south + 1.2, p.north - 1.2]) out.push(lantern((p.west + p.east + POST) / 2, z, top));
  return out;
};

/** The beds along the parapets in 2 m lengths, each knee high over the highest ground along it. */
const beds = (): Piece[] =>
  PARAPET_BEDS.flatMap((b) => {
    const out: Piece[] = [];
    for (let z = b.z0; z < b.z1 - 1e-6; z += BED_STEP) {
      const z1 = Math.min(z + BED_STEP, b.z1);
      const g = Math.max(groundY(b.x0, z), groundY(b.x1, z), groundY(b.x0, z1), groundY(b.x1, z1));
      const low = Math.min(groundY(b.x0, z), groundY(b.x1, z), groundY(b.x0, z1), groundY(b.x1, z1));
      out.push(piece(box(b.x0, b.x1, z, z1, cm(low - 0.3), cm(g + BED_HEIGHT)), "green", false));
    }
    return out;
  });

/** Every piece of T0's square and the green roof, in the world's axes (none inside the hall). */
export const squarePieces = (): Piece[] => [...walkPergola(), ...backPergola(), ...doorPergola(), ...beds(), ...ROOF_LAWNS.map((b) => piece(b, "lawn", false, false))];
