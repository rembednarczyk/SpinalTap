/**
 * `prop-on-canopy-post` (G-966, T-346, the curator's proposal of 24.11): a market stall's canvas
 * closer than `NEAR` to the face of a canopy's post (`CANOPY_POST` 0.25 m wide): the post stood in
 * the canvas of Targ na Ruskiej's stalls. The canvas is 2.4 x 1.8 m in the stall's frame
 * (`turnLocal`, the renderer's convention), the post a circle round its middle.
 */

type Pt = { readonly x: number; readonly z: number };
type Stall = Pt & { readonly yaw: number };
type Finding = { readonly at: string; readonly what: string };

/** The canvas's half extents along the stall's x and z (m). */
export const CANVAS = { hx: 1.2, hz: 0.9 } as const;
/** How near the canvas may come to a post's face (m). */
export const NEAR = 0.125;

/** The distance from p to the stall's canvas, 0 inside it: p turned into the stall's frame (the inverse of `turnLocal`). */
export const canvasDistance = (s: Stall, p: Pt): number => {
  const [dx, dz] = [p.x - s.x, p.z - s.z];
  const [c, n] = [Math.cos(s.yaw), Math.sin(s.yaw)];
  const lx = dx * c - dz * n;
  const lz = dx * n + dz * c;
  return Math.hypot(Math.max(Math.abs(lx) - CANVAS.hx, 0), Math.max(Math.abs(lz) - CANVAS.hz, 0));
};

export const stallsOnPosts = (posts: readonly (Pt & { readonly id: string })[], stalls: readonly Stall[], post: number): Finding[] =>
  stalls.flatMap((s) => {
    const hit = posts.find((q) => Math.abs(q.x - s.x) < 3 && Math.abs(q.z - s.z) < 3 && canvasDistance(s, q) - post / 2 < NEAR);
    return hit ? [{ at: `${s.x.toFixed(0)},${s.z.toFixed(0)}`, what: `a stall's canvas ${(canvasDistance(s, hit) - post / 2).toFixed(2)} m from a post of ${hit.id} at ${hit.x.toFixed(1)},${hit.z.toFixed(1)}` }] : [];
  });
