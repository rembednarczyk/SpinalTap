import { FARA_HOLO, FARA_HOLO_FACETS, type HoloFacet } from "@seki/sim";
import type { MeshSink, Vec } from "../mesh-sink";
import type { Box2 } from "./polygon";
import { MAP_SIGN_KIND, signTint } from "./sign-plan";
import { type Uv, quadUv } from "./sink-ops";

/*
 * The hologram of St Michael's parish church over its foundations on Plac po Farze (`fara-holo.ts` in the simulation's
 * content) in the map city's signs' mesh of the cell holding it, as the building sites' boards' panes (`site-signs.ts`):
 * every facet a pane of the sign shader's hologram (`holoPanel`: a faint fill brightest at its foot, a frame of light
 * along its edges, scanlines running up, a flicker now and then), both ways, additive. No draw call and no mesh more.
 * Pattern: the "ghost structure" of reconstructions over a ruin; the pane, the city's own hologram.
 */

/** The hologram's cyan, as the city's holo lines (`prop-civic.ts`). */
const TINT = "#38e4ff";
/** The panes' brightness: under the boards' (1), the church is large and many of its panes overlap. */
const BRIGHTNESS = 0.7;

const UV: readonly [Uv, Uv, Uv, Uv] = [
  [0, 0],
  [1, 0],
  [1, 1],
  [0, 1],
];
const v = (p: readonly [number, number, number]): Vec => ({ x: p[0], y: p[1], z: p[2] });

const normalOf = (a: Vec, b: Vec, c: Vec): Vec => {
  const [ux, uy, uz] = [b.x - a.x, b.y - a.y, b.z - a.z];
  const [wx, wy, wz] = [c.x - a.x, c.y - a.y, c.z - a.z];
  const n = { x: uy * wz - uz * wy, y: uz * wx - ux * wz, z: ux * wy - uy * wx };
  const l = Math.hypot(n.x, n.y, n.z) || 1;
  return { x: n.x / l, y: n.y / l, z: n.z / l };
};

/** One facet both ways (the signs cull their backs). */
const pane = (sink: MeshSink, f: HoloFacet, seed: number): void => {
  const c = f.map(v);
  const quad: [Vec, Vec, Vec, Vec] = c.length === 3 ? [c[0]!, c[1]!, c[2]!, c[2]!] : [c[0]!, c[1]!, c[2]!, c[3]!];
  // A triangle is a quad whose last two corners are its point: its frame along its base and one side, the other side
  // framed by the next facet round (the spire's, the hips').
  const uv = UV;
  const n = normalOf(quad[0], quad[1], quad[2]);
  const color = signTint(TINT, BRIGHTNESS);
  quadUv(sink, quad, n, color, uv, [seed, MAP_SIGN_KIND.holoPanel]);
  quadUv(sink, [quad[1], quad[0], quad[3], quad[2]], { x: -n.x, y: -n.y, z: -n.z }, color, [uv[1], uv[0], uv[3], uv[2]], [seed, MAP_SIGN_KIND.holoPanel]);
};

/** The church's hologram, when the cell (half-open bounds) holds it; how many panes it drew. */
export const planFaraHolo = (sink: MeshSink, bounds: Box2, facets: readonly HoloFacet[] = FARA_HOLO_FACETS): number => {
  const { x, z } = FARA_HOLO;
  if (x < bounds.minX || x >= bounds.maxX || z < bounds.minZ || z >= bounds.maxZ) return 0;
  // One seed for the whole church: its panes flicker together, as one projection.
  facets.forEach((f) => pane(sink, f, 0.31));
  return facets.length;
};
