import { groundY } from "../lublin/terrain";
import { P1_RAMP } from "./parking";
import { type Piece, box, piece } from "./plan";

/**
 * What stays of T0's square over P-1 (ADR-0074 stage 7, decision 7.11) under the front's storeys
 * (B1, decisions of 19.11: the complex fills the whole site): the beds of flowers along the ramp's
 * trench, knee high (seats too; the east one narrower, by the walk from the ramp's top to the stair
 * house), so the trench reads as the passage's, not a hole in a car park. The import lays the
 * setts (T-241); the pergolas, their lanterns and garlands went with the square, its green up onto
 * the terraces (`tiers.ts`, `front.ts`). The beds are solid and keep clear of the level graph's
 * nodes and edges on T0 (`parking-nav.ts`, `nav.ts`), of the people waiting there (`market.ts`) and
 * of the map's streets (`cut-on-road`).
 */

/** Rounded to the centimetre, as the simulation's other heights. */
const cm = (v: number): number => Math.round(v * 100) / 100;

/**
 * The beds along the trench's parapets: west the whole open length, east 8 m (to z 8 until ADR-0093
 * O2b), short of the map's lamp on the main entrance's way's east edge (422.8; 3.5): with the bed
 * beside it the way was 3.8 m wide there.
 */
export const PARAPET_BEDS = [
  { x0: P1_RAMP.minX - 0.3 - 0.8, x1: P1_RAMP.minX - 0.3, z0: -6.8, z1: 11 },
  { x0: P1_RAMP.maxX + 0.3, x1: P1_RAMP.maxX + 0.3 + 0.5, z0: -6.8, z1: 1.2 },
] as const;
const BED_HEIGHT = 0.45;
const BED_STEP = 2;

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

/**
 * What stays of T0's square under the front's storeys (B1, 19.11): the beds along the trench. The
 * pergolas went with the square, its green up onto the terraces.
 */
export const squarePieces = (): Piece[] => beds();
