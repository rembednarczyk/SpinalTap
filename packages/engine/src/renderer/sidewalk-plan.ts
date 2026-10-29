import { CROSSINGS, type Crossing, SIDEWALKS, SIDEWALK_HEIGHT, type Walkway } from "@seki/sim";
import { type MeshSink, hexColor } from "./mesh-sink";

/**
 * Sidewalks in the chunk dressing (ADR-0041): the slab, a lighter kerb along every edge that
 * faces the road, joints between the paving slabs, the yellow tactile strip of a Japanese
 * sidewalk, and zebra crossings on the road where the residents cross. Baked into the chunk's
 * dressing mesh, so they cost no mesh and no draw call of their own.
 */

const PAVING = hexColor("#525861");
const KERB = hexColor("#8d9299");
const JOINT = hexColor("#30343b");
const TACTILE = hexColor("#7d6a34");
const STRIPE = hexColor("#c4c8ce");

const KERB_WIDTH = 0.16;
/** Paving slabs this long between joints (m). */
const SLAB = 1.5;
const TACTILE_WIDTH = 0.26;

const H = SIDEWALK_HEIGHT;

/** A flat strip on top of the slab, from (x0, z0) to (x1, z1), `lift` above it. */
const strip = (sink: MeshSink, x0: number, z0: number, x1: number, z1: number, y: number, color: ReturnType<typeof hexColor>): void => {
  sink.quad(
    [
      { x: x0, y, z: z0 },
      { x: x1, y, z: z0 },
      { x: x1, y, z: z1 },
      { x: x0, y, z: z1 },
    ],
    { x: 0, y: 1, z: 0 },
    color,
  );
};

const walkway = (sink: MeshSink, w: Walkway): void => {
  const cx = (w.minX + w.maxX) / 2;
  const cz = (w.minZ + w.maxZ) / 2;
  const sx = w.maxX - w.minX;
  const sz = w.maxZ - w.minZ;
  sink.box({ x: cx, y: H / 2, z: cz }, sx, H, sz, PAVING, { bottom: false });
  for (const side of w.kerbs) {
    const alongZ = side === "x+" || side === "x-";
    const edge = side === "x+" ? w.maxX - KERB_WIDTH / 2 : side === "x-" ? w.minX + KERB_WIDTH / 2 : side === "z+" ? w.maxZ - KERB_WIDTH / 2 : w.minZ + KERB_WIDTH / 2;
    const c = alongZ ? { x: edge, y: (H + 0.012) / 2, z: cz } : { x: cx, y: (H + 0.012) / 2, z: edge };
    sink.box(c, alongZ ? KERB_WIDTH : sx, H + 0.012, alongZ ? sz : KERB_WIDTH, KERB, { bottom: false });
  }
  const long = Math.max(sx, sz);
  const alongX = sx >= sz;
  const width = Math.min(sx, sz);
  // Joints across the walk, every slab.
  for (let s = SLAB; s < long - 0.2; s += SLAB) {
    if (alongX) strip(sink, w.minX + s - 0.015, w.minZ, w.minX + s + 0.015, w.maxZ, H + 0.004, JOINT);
    else strip(sink, w.minX, w.minZ + s - 0.015, w.maxX, w.minZ + s + 0.015, H + 0.004, JOINT);
  }
  if (width < 1.6) return;
  // The tactile strip runs along the middle, a little towards the buildings.
  const kerbHigh = alongX ? w.kerbs.includes("z+") && !w.kerbs.includes("z-") : w.kerbs.includes("x+") && !w.kerbs.includes("x-");
  const mid = (alongX ? cz : cx) + (kerbHigh ? -0.2 : 0.2);
  if (alongX) strip(sink, w.minX + 0.3, mid - TACTILE_WIDTH / 2, w.maxX - 0.3, mid + TACTILE_WIDTH / 2, H + 0.003, TACTILE);
  else strip(sink, mid - TACTILE_WIDTH / 2, w.minZ + 0.3, mid + TACTILE_WIDTH / 2, w.maxZ - 0.3, H + 0.003, TACTILE);
};

/** White bars along the traffic, one after another across the road. */
const crossing = (sink: MeshSink, c: Crossing): void => {
  const y = 0.014;
  if (c.along === "x") for (let x = c.minX + 0.35; x + 0.45 <= c.maxX - 0.2; x += 0.9) strip(sink, x, c.minZ, x + 0.45, c.maxZ, y, STRIPE);
  else for (let z = c.minZ + 0.35; z + 0.45 <= c.maxZ - 0.2; z += 0.9) strip(sink, c.minX, z, c.maxX, z + 0.45, y, STRIPE);
};

/** Adds the sidewalks and crossings of `chunk` to its dressing. */
export const planSidewalks = (sink: MeshSink, chunk: string, walks: readonly Walkway[] = SIDEWALKS, crossings: readonly Crossing[] = CROSSINGS): void => {
  for (const w of walks) if (w.chunk === chunk) walkway(sink, w);
  for (const c of crossings) if (c.chunk === chunk) crossing(sink, c);
};
