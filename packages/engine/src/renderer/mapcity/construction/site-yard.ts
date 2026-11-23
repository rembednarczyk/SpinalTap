import { SITE_BOARD, SITE_CABIN } from "@seki/core";
import { MeshSink } from "../../mesh-sink";
import { glow, paint } from "../prop-kit";
import { GRAPHITE, GRAPHITE_LIGHT, HAZARD, STEEL, facing, slab } from "./site-slab";

const FLAT = { rise: 0, length: 1 };

/** The containers' liveries: white, blue, hazard yellow, grey. */
const CABINS = ["#d6d6d0", "#3f6ea6", "#cfa83a", "#80868e"].map(paint);
const DOOR = paint("#25272c");
const WINDOW = glow("#9fd8ff");
const SCREENS = ["#14b4d8", "#d83aa8", "#e0a030", "#4ad08a"].map(glow);
/** The board's screen under its letters: dark, so the neon reads on it. */

/**
 * An office container of a site's back yard (ADR-0087 stage 1): a 20 ft cabin, its roof's rim and
 * its corner posts darker, its door and two lit windows on its front (+z, to the site), a window
 * at the back. The variant's low bits pick the livery; a stacked one (`+ 4`) is the same cabin.
 */
export const cabinModel = (variant: number): MeshSink => {
  const sink = new MeshSink();
  const { hx, hz, height: h } = SITE_CABIN;
  slab(sink, FLAT, -hx, hx, -hz, hz, 0, h - 0.1, CABINS[variant % CABINS.length]!);
  slab(sink, FLAT, -hx - 0.02, hx + 0.02, -hz - 0.02, hz + 0.02, h - 0.1, h, STEEL);
  for (const x of [-hx, hx]) for (const z of [-hz, hz]) slab(sink, FLAT, x - 0.06, x + 0.06, z - 0.06, z + 0.06, 0, h, STEEL);
  facing(sink, FLAT, hz + 0.01, -hx + 0.5, -hx + 1.4, 0.05, 2.1, DOOR);
  for (const x0 of [-0.4, 1.4]) facing(sink, FLAT, hz + 0.01, x0, x0 + 1.1, 1.1, 1.9, WINDOW);
  facing(sink, FLAT, -hz - 0.01, -0.6, 0.6, 1.2, 1.8, WINDOW, -1);
  return sink;
};

/**
 * The information board on the fence by the gate (ADR-0087 step 8), facing the street (+z): a hologram since 22.11 (the
 * user's note), so of it only its projector stands, a graphite bar on the fence under the picture with its lens lit in the
 * board's colour, and a hazard strip under it. The pane of light over it and its three lines are in the map's signs' mesh
 * (`site-signs.ts`), in the player's language.
 */
export const boardModel = (variant: number): MeshSink => {
  const sink = new MeshSink();
  const hw = SITE_BOARD.width / 2;
  const b = SITE_BOARD.bottom;
  const rim = SCREENS[variant % SCREENS.length]!;
  slab(sink, FLAT, -hw * 0.8, hw * 0.8, -0.06, 0.14, b - 0.2, b - 0.06, GRAPHITE);
  slab(sink, FLAT, -hw * 0.8 - 0.03, hw * 0.8 + 0.03, -0.07, 0.15, b - 0.24, b - 0.2, GRAPHITE_LIGHT);
  // The lens along its top, lit: the picture's light comes from it.
  slab(sink, FLAT, -hw * 0.72, hw * 0.72, 0.02, 0.1, b - 0.06, b - 0.045, rim);
  facing(sink, FLAT, 0.035, -hw * 0.8, hw * 0.8, b - 0.36, b - 0.26, HAZARD);
  return sink;
};
