/**
 * Streets that sink over a tunnel (G-088): the NMT is bare earth with the tunnel's structure left
 * out, so where a way of the map runs over a tunnel it does not join (no node in common), the
 * terrain under the street dips into the cut the tunnel runs in. Zamkowa over the footway under
 * it before the Castle (w66258159) fell 3.5 m and rose again over 10 m.
 */

type Pt = { readonly x: number; readonly z: number };

/** A way of the map with its nodes, so a crossing at a node in common is told from one over the other. */
export interface NodeWay {
  readonly id: string;
  readonly tags: Readonly<Record<string, string>>;
  readonly nodes: readonly number[];
  readonly line: readonly Pt[];
}

/** How far along the street either side of the crossing the ground is measured (m). */
export const REACH = 8;
/** How far the ground may lie under the chord between the two ends before it reads as a dip (m). */
export const DIP = 1;

const tunnel = (t: NodeWay["tags"]) => t.highway !== undefined && (t.tunnel === "yes" || t.tunnel === "culvert" || Number(t.layer ?? 0) < 0);
const onTop = (t: NodeWay["tags"]) =>
  t.highway !== undefined && t.area !== "yes" && (t.tunnel === undefined || t.tunnel === "no") && t.covered === undefined && Number(t.layer ?? 0) >= 0 && (t.bridge === undefined || t.bridge === "no");

/** Where along `a`-`b` (0..1) it crosses `c`-`d`, or null. */
const crossing = (a: Pt, b: Pt, c: Pt, d: Pt): number | null => {
  const den = (b.x - a.x) * (d.z - c.z) - (b.z - a.z) * (d.x - c.x);
  if (Math.abs(den) < 1e-9) return null;
  const s = ((c.x - a.x) * (d.z - c.z) - (c.z - a.z) * (d.x - c.x)) / den;
  const u = ((c.x - a.x) * (b.z - a.z) - (c.z - a.z) * (b.x - a.x)) / den;
  return s >= 0 && s <= 1 && u >= 0 && u <= 1 ? s : null;
};

/** The point `s` m along a polyline, clamped to its ends. */
const at = (line: readonly Pt[], s: number): Pt => {
  let left = Math.max(0, s);
  for (let i = 0; i + 1 < line.length; i++) {
    const [a, b] = [line[i]!, line[i + 1]!];
    const len = Math.hypot(b.x - a.x, b.z - a.z);
    if (left <= len) return { x: a.x + ((b.x - a.x) * left) / (len || 1), z: a.z + ((b.z - a.z) * left) / (len || 1) };
    left -= len;
  }
  return line[line.length - 1]!;
};

/**
 * Each crossing of a street on the ground (`onTop`) over a highway's tunnel, not at a node the two
 * share, on the map (`onMap`), where the game's ground `h` within `REACH` m of it along the street lies
 * more than `DIP` under the chord between the two ends.
 */
export const roadDipsOverTunnels = (ways: readonly NodeWay[], h: (p: Pt) => number, onMap: (p: Pt) => boolean): { readonly at: string; readonly what: string }[] => {
  const tunnels = ways.filter((w) => tunnel(w.tags));
  return ways.filter((w) => onTop(w.tags)).flatMap((road) => {
    const out: { at: string; what: string }[] = [];
    let start = 0;
    for (let i = 0; i + 1 < road.line.length; i++) {
      const [a, b] = [road.line[i]!, road.line[i + 1]!];
      const len = Math.hypot(b.x - a.x, b.z - a.z);
      for (const t of tunnels) {
        for (let j = 0; j + 1 < t.line.length; j++) {
          const k = crossing(a, b, t.line[j]!, t.line[j + 1]!);
          if (k === null) continue;
          // At a node the two share the street leads into the tunnel: a ramp down, as the import has it.
          const node = k < 1e-6 ? road.nodes[i] : k > 1 - 1e-6 ? road.nodes[i + 1] : undefined;
          if (node !== undefined && t.nodes.includes(node)) continue;
          const p = { x: a.x + (b.x - a.x) * k, z: a.z + (b.z - a.z) * k };
          if (!onMap(p)) continue;
          const s = start + len * k;
          const [y0, y1] = [h(at(road.line, s - REACH)), h(at(road.line, s + REACH))];
          let dip = 0;
          for (let q = -REACH; q <= REACH; q += 0.5) dip = Math.max(dip, y0 + ((y1 - y0) * (q + REACH)) / (2 * REACH) - h(at(road.line, s + q)));
          if (dip > DIP) out.push({ at: `${p.x.toFixed(0)},${p.z.toFixed(0)}`, what: `${road.id} ${road.tags.name ?? road.tags.highway} over ${t.id}: ground ${dip.toFixed(2)} m under the chord ±${REACH} m` });
        }
      }
      start += len;
    }
    return out;
  });
};
