/**
 * `market-stall-off-tent` (G-964, T-341, the curator's proposal of 24.11): a market stall whose
 * middle lies in a marketplace whose tents the props plan maps from the orthophoto
 * (`docs/world/lublin-props.todo.json`, `tents`) but under none of them, each tent's rectangle
 * grown by `PAD`. The stalls of such a market stand in rows under its real roofs (`tentStalls`).
 */

type Pt = { readonly x: number; readonly z: number };
/** A tent as the plan has it: its middle x and z, its axis's angle in degrees from +x towards +z, its length along it and its width. */
export type Tent = readonly [number, number, number, number, number];
export interface TentMarket {
  readonly id: string;
  /** Its outline, x and z in turn. */
  readonly polygon: readonly number[];
  readonly tents: readonly Tent[];
}
type Finding = { readonly at: string; readonly what: string };

/** How far past a tent's edge a stall's middle may stand (m): the canvas's overhang, a centimetre's slack. */
export const PAD = 0.3;

const inRing = (p: Pt, poly: readonly number[]): boolean => {
  let inside = false;
  const n = poly.length / 2;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const [xi, zi, xj, zj] = [poly[2 * i]!, poly[2 * i + 1]!, poly[2 * j]!, poly[2 * j + 1]!];
    if (zi > p.z !== zj > p.z && p.x < ((xj - xi) * (p.z - zi)) / (zj - zi) + xi) inside = !inside;
  }
  return inside;
};

/** Is p under the tent, its rectangle grown by `pad`? */
export const underTent = (p: Pt, [x, z, deg, length, width]: Tent, pad = PAD): boolean => {
  const a = (deg * Math.PI) / 180;
  const [dx, dz] = [p.x - x, p.z - z];
  const along = dx * Math.cos(a) + dz * Math.sin(a);
  const across = -dx * Math.sin(a) + dz * Math.cos(a);
  return Math.abs(along) <= length / 2 + pad && Math.abs(across) <= width / 2 + pad;
};

export const stallsOffTents = (markets: readonly TentMarket[], stalls: readonly Pt[]): Finding[] =>
  markets.flatMap((m) =>
    stalls
      .filter((s) => inRing(s, m.polygon) && !m.tents.some((t) => underTent(s, t)))
      .map((s) => ({ at: `${s.x.toFixed(0)},${s.z.toFixed(0)}`, what: `${m.id}: a stall at ${s.x.toFixed(1)},${s.z.toFixed(1)} under none of its ${m.tents.length} tents` })),
  );
