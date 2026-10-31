import { type CityProps, facing, swatchAt, transformProp } from "../city-props";
import type { KitModel } from "../city-kit-data";
import { hexRgb } from "../city-kit-data";
import type { MeshSink, Rgba } from "../mesh-sink";

/**
 * The megatowers of the skyline from the CC-BY "Sci-Fi Megacity Cluster" (ADR-0063 stage 2): the
 * `megatower` models of `city-props.glb` (tools/city_megacity.py), height fields of the block's
 * tallest buildings on the kit's palette. Each tower of `MEGA_SITES` takes one of them for its
 * body, scaled to its height and turned to the city centre; the skyline's procedural tiers stay
 * for the phone and until the file is in. Pure geometry, no Babylon.
 */

export const MEGATOWER = "megatower";

/** Body vertices: uv2.x of a lit one (windows and neon bands of the source, drawn as light). */
export const BODY_GLOW = 3.5;

/** Across, a tower is scaled this much less than up (the cut is a block with its podium; whole, the towers read as needles). */
const SLIM = 0.8;

/** Facade swatches are dark for a far silhouette: lifted to the procedural towers' tints. */
const LIFT = 1.6;

export interface MegaBody {
  readonly model: KitModel;
  /** Per vertex: colour and whether it is self-lit. */
  readonly colors: readonly Rgba[];
  readonly lit: readonly boolean[];
}

/** The megatower bodies of the props file, in file order (none without them). */
export const megaBodies = (props: CityProps | null): MegaBody[] =>
  (props?.byStyle.get(MEGATOWER) ?? []).map((model) => {
    const colors: Rgba[] = [];
    const lit: boolean[] = [];
    for (let i = 0; i < model.uvs.length; i += 2) {
      const s = props!.swatches[swatchAt(props!, model.uvs[i] ?? 0, model.uvs[i + 1] ?? 0)];
      const [r, g, b] = hexRgb(s?.color ?? "#5a6170");
      const glow = s?.kind === "glow";
      const k = glow ? 1 : LIFT;
      colors.push([Math.min(1, r * k), Math.min(1, g * k), Math.min(1, b * k), 1]);
      lit.push(glow);
    }
    return { model, colors, lit };
  });

/** Where a body goes: its foot at (x, z), `h` tall, its front (-Z of the model) towards `front`. */
export interface BodyPlace {
  readonly x: number;
  readonly z: number;
  readonly h: number;
  readonly front: { readonly x: number; readonly z: number };
}

/**
 * How far the body reaches towards its front between heights `lo` and `hi` (fractions of its
 * height), from its foot: over the triangles that cross that band, whose corners may lie above and
 * below it (a wall is one quad from its foot to its roof).
 */
const reachAt = (positions: Float32Array, indices: Uint32Array, at: BodyPlace, lo: number, hi: number): number => {
  let reach = 0;
  for (let t = 0; t < indices.length; t += 3) {
    const corners = [indices[t] ?? 0, indices[t + 1] ?? 0, indices[t + 2] ?? 0];
    const ys = corners.map((i) => positions[i * 3 + 1] ?? 0);
    if (Math.max(...ys) < at.h * lo || Math.min(...ys) > at.h * hi) continue;
    for (const i of corners) reach = Math.max(reach, ((positions[i * 3] ?? 0) - at.x) * at.front.x + ((positions[i * 3 + 2] ?? 0) - at.z) * at.front.z);
  }
  return reach;
};

/** Scale of a body standing `h` tall: up, and across. */
export const bodyScale = (body: MegaBody, h: number): { up: number; across: number } => {
  const up = h / Math.max(body.model.size.y, 1);
  return { up, across: up * SLIM };
};

/**
 * Adds a tower body to the skyline's tower sink: colour per vertex, uv2.x the tower's seed (the
 * shader paints windows on its walls) or `BODY_GLOW` for the lit ones. Returns how far it reaches
 * towards its front at 0.4 to 0.7 of its height, where the skyline hangs its ad.
 */
export const addBody = (sink: MeshSink, body: MegaBody, at: BodyPlace, seed: number): number => {
  const { up, across } = bodyScale(body, at.h);
  const xf = facing({ x: at.x, y: 0, z: at.z }, { x: at.front.x, y: 0, z: at.front.z }, { x: across, y: up, z: across });
  const { positions, normals } = transformProp(body.model, xf);
  const base = sink.vertexCount;
  for (let v = 0; v < positions.length / 3; v++) {
    const x = positions[v * 3] ?? 0;
    const y = positions[v * 3 + 1] ?? 0;
    const z = positions[v * 3 + 2] ?? 0;
    sink.positions.push(x, y, z);
    sink.normals.push(normals[v * 3] ?? 0, normals[v * 3 + 1] ?? 0, normals[v * 3 + 2] ?? 0);
    const c = body.colors[v] ?? [0.5, 0.5, 0.5, 1];
    sink.colors.push(c[0], c[1], c[2], c[3]);
    sink.uvs.push(0, 0);
    sink.uvs2.push(body.lit[v] ? BODY_GLOW : seed, 0);
  }
  for (const i of body.model.indices) sink.indices.push(base + i);
  return reachAt(positions, body.model.indices, at, 0.4, 0.7);
};
