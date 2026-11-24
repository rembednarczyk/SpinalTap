import { FARA_HOLO, FARA_HOLO_FACETS, FARA_HOLO_OUTLINES, type HoloFacet, type HoloPoint } from "@seki/sim";
import type { MeshSink, Vec } from "../mesh-sink";
import type { Box2 } from "./polygon";
import { MAP_SIGN_KIND, signTint } from "./sign-plan";
import { type Uv, quadUv } from "./sink-ops";

/*
 * The hologram of St Michael's parish church over its foundations on Plac po Farze (`fara-holo.ts` in the simulation's
 * content) in the map city's signs' mesh of the cell holding it, as the building sites' boards' panes (`site-signs.ts`):
 * every facet a pane of the sign shader's hologram (`holoPanel`: a faint fill brightest at its foot, a frame of light
 * along its edges, scanlines running up, a flicker now and then), both ways, additive; the windows' and the doors'
 * outlines thin tubes of light on the walls (`tube`, the facades' neon strips). No draw call and no mesh more.
 * Pattern: the "ghost structure" of reconstructions over a ruin; the pane, the city's own hologram.
 */

/** The hologram's cyan, as the city's holo lines (`prop-civic.ts`). */
const TINT = "#38e4ff";
/** The panes' brightness: under the boards' (1), the church is large and many of its panes overlap. */
const BRIGHTNESS = 0.55;

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

/** An outline's tubes' width (m) and brightness: a window's frame of light, under the facades' neon. */
const TUBE = { width: 0.09, brightness: 0.6 } as const;
/** The tubes' uv: across the tube (v) brightest at its middle (the shader's `tube`). */
const TUBE_UV: readonly [Uv, Uv, Uv, Uv] = [
  [0, 0],
  [1, 0],
  [1, 1],
  [0, 1],
];

/** One closed outline as tubes along its sides, in its own plane, both ways. */
const outline = (sink: MeshSink, pts: readonly HoloPoint[]): void => {
  const c = pts.map(v);
  const n = normalOf(c[0]!, c[1]!, c[2]!);
  const color = signTint(TINT, TUBE.brightness);
  c.forEach((a, k) => {
    const b = c[(k + 1) % c.length]!;
    const d = { x: b.x - a.x, y: b.y - a.y, z: b.z - a.z };
    // Across the side, in the outline's plane: the side's direction crossed with the plane's normal.
    const s = { x: d.y * n.z - d.z * n.y, y: d.z * n.x - d.x * n.z, z: d.x * n.y - d.y * n.x };
    const l = Math.hypot(s.x, s.y, s.z) || 1;
    const h = { x: (s.x / l) * (TUBE.width / 2), y: (s.y / l) * (TUBE.width / 2), z: (s.z / l) * (TUBE.width / 2) };
    const q: [Vec, Vec, Vec, Vec] = [
      { x: a.x - h.x, y: a.y - h.y, z: a.z - h.z },
      { x: b.x - h.x, y: b.y - h.y, z: b.z - h.z },
      { x: b.x + h.x, y: b.y + h.y, z: b.z + h.z },
      { x: a.x + h.x, y: a.y + h.y, z: a.z + h.z },
    ];
    quadUv(sink, q, n, color, TUBE_UV, [0, MAP_SIGN_KIND.tube]);
    quadUv(sink, [q[1], q[0], q[3], q[2]], { x: -n.x, y: -n.y, z: -n.z }, color, [TUBE_UV[1], TUBE_UV[0], TUBE_UV[3], TUBE_UV[2]], [0, MAP_SIGN_KIND.tube]);
  });
};

/** The church's hologram, when the cell (half-open bounds) holds it; how many panes and outlines it drew. */
export const planFaraHolo = (
  sink: MeshSink,
  bounds: Box2,
  facets: readonly HoloFacet[] = FARA_HOLO_FACETS,
  outlines: readonly (readonly HoloPoint[])[] = FARA_HOLO_OUTLINES,
): number => {
  const { x, z } = FARA_HOLO;
  if (x < bounds.minX || x >= bounds.maxX || z < bounds.minZ || z >= bounds.maxZ) return 0;
  // One seed for the whole church: its panes flicker together, as one projection.
  facets.forEach((f) => pane(sink, f, 0.31));
  outlines.forEach((o) => outline(sink, o));
  return facets.length + outlines.length;
};
