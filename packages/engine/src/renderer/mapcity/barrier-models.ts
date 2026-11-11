import { BARRIER_THICKNESS, type BarrierLayout, barrierLayout } from "@seki/core";
import { MeshSink, type Rgba } from "../mesh-sink";
import type { RenderQuality } from "../../npr/quality";
import { type WorldProp, bake } from "./prop-batch";
import { paint } from "./prop-kit";
import { quadUv } from "./sink-ops";

/**
 * The map's walls, fences, hedges and gates (ADR-0077 point 4) as street pieces of kind `barrier`
 * (`barriers.ts` in `@seki/core`): one straight stretch each, along its +z, centred on its foot,
 * the ground rising `rise` from its -z end to its +z end. Baked into the furniture's block meshes
 * (`prop-block.ts`), so they cost no draw call of their own. A wall is a block with a coping, the
 * city walls a thick brick one, a hedge a green mass, a fence an open work of posts, rails and
 * bars, a gate two posts and a lift gate a post with its arm raised. Colours of the furniture's
 * palette: the granite and concrete of the kerbs, the facades' brick, the shrubs' green, iron.
 */

const SINK = 0.3;
const CONCRETE = paint("#8e8d88");
const CONCRETE_DARK = paint("#6f6e6a");
const BRICK = paint("#8b4632");
const BRICK_DARK = paint("#6e3526");
const STONE = paint("#a59d8c");
const HEDGE = paint("#3b6936");
const HEDGE_TOP = paint("#467640");
const IRON = paint("#1b1d21");
const WOOD = paint("#6d4527");
const ARM = paint("#c8322b");
const ARM_WHITE = paint("#e6e3dc");

/** A wall's face by the map's `material`. */
const wallColour = (b: BarrierLayout): [Rgba, Rgba] => {
  if (b.material === "brick" || (b.kind === "city-wall" && b.material === "plain")) return [BRICK, BRICK_DARK];
  if (b.material === "stone") return [STONE, CONCRETE_DARK];
  return [CONCRETE, CONCRETE_DARK];
};

/**
 * A box along the piece, `x0..x1` across and `z0..z1` along, its bottom `SINK` under the ground
 * and its top `top` over it (both follow the rise), from `from` metres over the ground up.
 */
const shearedBox = (sink: MeshSink, b: BarrierLayout, x0: number, x1: number, z0: number, z1: number, from: number, top: number, color: Rgba, ends = true): void => {
  const y = (z: number, h: number) => (b.rise * z) / Math.max(b.length, 1e-6) + h;
  const lo = from <= 0 ? -SINK : from;
  const p = (x: number, z: number, h: number) => ({ x, y: y(z, h), z });
  const up = { x: 0, y: 1, z: 0 };
  const uv = [
    [0, 0],
    [1, 0],
    [1, 1],
    [0, 1],
  ] as const;
  quadUv(sink, [p(x0, z0, top), p(x1, z0, top), p(x1, z1, top), p(x0, z1, top)], up, color, uv);
  quadUv(sink, [p(x0, z0, lo), p(x0, z1, lo), p(x0, z1, top), p(x0, z0, top)], { x: -1, y: 0, z: 0 }, color, uv);
  quadUv(sink, [p(x1, z0, lo), p(x1, z0, top), p(x1, z1, top), p(x1, z1, lo)], { x: 1, y: 0, z: 0 }, color, uv);
  if (!ends) return;
  quadUv(sink, [p(x0, z0, lo), p(x0, z0, top), p(x1, z0, top), p(x1, z0, lo)], { x: 0, y: 0, z: -1 }, color, uv);
  quadUv(sink, [p(x0, z1, lo), p(x1, z1, lo), p(x1, z1, top), p(x0, z1, top)], { x: 0, y: 0, z: 1 }, color, uv);
};

/** A post `side` square at `z` along the piece, `top` over the ground. */
const post = (sink: MeshSink, b: BarrierLayout, z: number, side: number, top: number, color: Rgba): void => shearedBox(sink, b, -side / 2, side / 2, z - side / 2, z + side / 2, 0, top, color);

/** A wall: its block and a coping a little wider on top. */
const wall = (sink: MeshSink, b: BarrierLayout, far: boolean): void => {
  const ht = BARRIER_THICKNESS[b.kind] / 2;
  const hl = b.length / 2;
  const [face, cap] = wallColour(b);
  if (far) return shearedBox(sink, b, -ht, ht, -hl, hl, 0, b.height, face);
  shearedBox(sink, b, -ht, ht, -hl, hl, 0, b.height - 0.07, face);
  shearedBox(sink, b, -ht - 0.03, ht + 0.03, -hl, hl, b.height - 0.07, b.height, cap);
};

/** A hedge: a clipped green mass, its top a shade lighter and a little narrower. */
const hedge = (sink: MeshSink, b: BarrierLayout): void => {
  const ht = BARRIER_THICKNESS.hedge / 2;
  const hl = b.length / 2;
  shearedBox(sink, b, -ht, ht, -hl, hl, 0, b.height - 0.12, HEDGE);
  shearedBox(sink, b, -ht + 0.08, ht - 0.08, -hl, hl, b.height - 0.12, b.height, HEDGE_TOP);
};

/** Longest bay of a fence between its posts (m), and its bars' spacing; the low quality goes without bars. */
const FENCE_BAY = 2.5;
const BAR_STEP = 0.16;

/** A fence: posts at its ends and every bay, two rails, and bars between them you see through. */
const fence = (sink: MeshSink, b: BarrierLayout, quality: RenderQuality): void => {
  const colour = b.material === "wood" ? WOOD : IRON;
  const hl = b.length / 2;
  const bays = Math.max(1, Math.ceil(b.length / FENCE_BAY));
  for (let k = 0; k <= bays; k++) post(sink, b, -hl + (b.length * k) / bays, 0.08, b.height, colour);
  for (const h of [0.12, b.height - 0.08]) shearedBox(sink, b, -0.02, 0.02, -hl, hl, h, h + 0.05, colour, false);
  if (quality === "low") {
    shearedBox(sink, b, -0.02, 0.02, -hl, hl, b.height / 2, b.height / 2 + 0.04, colour, false);
    return;
  }
  const bars = Math.floor(b.length / BAR_STEP);
  for (let k = 1; k < bars; k++) {
    const z = -hl + (b.length * k) / bars;
    shearedBox(sink, b, -0.012, 0.012, z - 0.012, z + 0.012, 0.12, b.height - 0.03, colour, false);
  }
};

/** A gate: its two posts, a little over the barrier; a lift gate: a post with its housing and the arm raised. */
const opening = (sink: MeshSink, b: BarrierLayout): void => {
  const hl = b.length / 2;
  if (b.kind === "gate") {
    for (const z of [-hl, hl]) post(sink, b, z, 0.2, b.height + 0.2, CONCRETE_DARK);
    return;
  }
  post(sink, b, -hl, 0.3, b.height, ARM_WHITE);
  // The arm stands up from the housing, in red and white bands.
  const bands = 6;
  const arm = Math.max(2, b.length * 0.9);
  for (let k = 0; k < bands; k++) {
    const h0 = b.height + (arm * k) / bands;
    shearedBox(sink, b, -0.05, 0.05, -hl - 0.05, -hl + 0.05, h0, h0 + arm / bands, k % 2 === 0 ? ARM : ARM_WHITE);
  }
};

/** A barrier piece in its own frame, near (`far` false) or as the far mesh's block (null for kinds not drawn far). */
export const barrierModel = (variant: number, quality: RenderQuality, far = false): MeshSink | null => {
  const b = barrierLayout(variant);
  const sink = new MeshSink();
  if (b.kind === "fence") {
    if (far) return null;
    fence(sink, b, quality);
  } else if (b.kind === "hedge") hedge(sink, b);
  else if (b.kind === "gate" || b.kind === "lift-gate") {
    if (far) return null;
    opening(sink, b);
  } else wall(sink, b, far);
  return sink;
};

/** Bakes a barrier piece at its place into a block's sink (near or far). */
export const bakeBarrier = (sink: MeshSink, p: WorldProp, quality: RenderQuality, far = false): void => {
  const model = barrierModel(p.variant ?? 0, quality, far);
  if (model) bake(sink, model, { ...p, scale: 1 });
};
