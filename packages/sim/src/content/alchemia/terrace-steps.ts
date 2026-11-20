import { surfaceY } from "../lublin/terrain";
import { type Piece, box, piece } from "./plan";
import { EAST_RAMP, EAST_STEPS_HALF } from "./terraces";

/** How far a tread's top stands over the paving drawn at its upper edge (m). */
const OVER = 0.02;
/** How deep a tread's foot reaches under the ground at its lower edge, as the walls' `SINK` (m). */
const SINK = 0.3;

/** The paving drawn along a line across the ramp at `z` from `x0` to `x1` (the ground and its lift), its highest and lowest. */
const across = (x0: number, x1: number, z: number): { readonly high: number; readonly low: number } => {
  const ys = Array.from({ length: Math.ceil(x1 - x0) * 2 + 1 }, (_, i) => surfaceY(x0 + ((x1 - x0) * i) / (Math.ceil(x1 - x0) * 2), z));
  return { high: Math.max(...ys), low: Math.min(...ys) };
};

/**
 * The east ramp's steps (ADR-0074 stage 1, ADR-0045's steps on a ramp): drawn, not solid (bodies
 * walk its slope), a metre of going each. Each tread on the paving the renderer drapes over the
 * ramp: its top `OVER` above the highest of it along its upper edge, its foot `SINK` under the
 * lowest along its lower edge (the user's 20.11, `alchemia-off-ground`). Level with the ramp's
 * axis, the square's paving (`SURFACE_LIFT` over the ground) covered the back of every tread, and
 * the car park's ground over the ramp's head its first four (to 0.2 m).
 */
export const terracePieces = (): Piece[] => {
  const out: Piece[] = [];
  const r = EAST_RAMP;
  const [x0, x1] = [r.a.x - EAST_STEPS_HALF, r.a.x + EAST_STEPS_HALF];
  for (let z = r.a.z; z < r.b.z - 1e-6; z += 1) {
    const top = Math.max(across(x0, x1, z).high, across(x0, x1, z + 0.5).high) + OVER;
    out.push(piece(box(x0, x1, z, z + 1, across(x0, x1, z + 1).low - SINK, top), "step", false, false));
  }
  return out;
};
