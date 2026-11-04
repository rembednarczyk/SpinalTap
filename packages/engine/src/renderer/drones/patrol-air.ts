import { BinIndex } from "../mapcity/map-index";
import { type Box2, type P2, boundsOf, pointInRing } from "../mapcity/polygon";

/**
 * The air over the pedestrian streets as the low patrols see it (ADR-0058 stage 7b): what stands
 * up into it, as upright prisms (buildings with the room their facades take, billboards,
 * footbridges, curtains of neon) and posts (street furniture, poles, the points of cables and of
 * the lanterns hung on them). Pure: the planner asks it where a patrol may fly; the glitch scan
 * checks the lanes against the drawn geometry itself.
 */

/** An upright prism: a ring, its foot and top (m), and the room its outside takes beyond the ring (a facade's signs, m). */
export interface AirPrism {
  readonly ring: readonly P2[];
  readonly bottom: number;
  readonly top: number;
  readonly pad: number;
}

/** An upright post: a circle (m) between a foot and a top. */
export interface AirPost {
  readonly x: number;
  readonly z: number;
  readonly r: number;
  readonly bottom: number;
  readonly top: number;
}

/** Distance from a point to a ring's area (0 inside). */
export const toRing = (p: P2, ring: readonly P2[]): number => {
  if (pointInRing(p, ring)) return 0;
  let best = Infinity;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[j] as P2;
    const b = ring[i] as P2;
    const dx = b.x - a.x;
    const dz = b.z - a.z;
    const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.z - a.z) * dz) / (dx * dx + dz * dz || 1)));
    best = Math.min(best, Math.hypot(a.x + dx * t - p.x, a.z + dz * t - p.z));
  }
  return best;
};

const around = (p: P2, r: number): Box2 => ({ minX: p.x - r, maxX: p.x + r, minZ: p.z - r, maxZ: p.z + r });

/** The widest pad of a prism and the widest post, for the bins searched round a point (m). */
const REACH = 6;

/** The prisms and posts of the air, by their 32 m bins. */
export class PatrolAir {
  private readonly prismIndex = new BinIndex();
  private readonly postIndex = new BinIndex();

  constructor(
    readonly prisms: readonly AirPrism[],
    readonly posts: readonly AirPost[],
  ) {
    prisms.forEach((p, i) => this.prismIndex.add(i, boundsOf(p.ring)));
    posts.forEach((p, i) => this.postIndex.add(i, around(p, p.r)));
  }

  /** The highest top of what stands within `r` of (x, z), -Infinity for nothing. */
  highest(p: P2, r: number): number {
    let top = -Infinity;
    for (const i of this.prismIndex.within(around(p, r))) {
      const s = this.prisms[i] as AirPrism;
      if (s.top > top && toRing(p, s.ring) <= r) top = s.top;
    }
    return top;
  }

  /**
   * Whether an upright cylinder `room` metres round (x, z) from `bottom` to `top` meets nothing:
   * no prism within its pad and no post within its radius, where their heights overlap.
   */
  clear(p: P2, bottom: number, top: number, room: number): boolean {
    for (const i of this.prismIndex.within(around(p, room + REACH))) {
      const s = this.prisms[i] as AirPrism;
      if (bottom < s.top && top > s.bottom && toRing(p, s.ring) < room + s.pad) return false;
    }
    for (const i of this.postIndex.within(around(p, room + REACH))) {
      const s = this.posts[i] as AirPost;
      if (bottom < s.top && top > s.bottom && Math.hypot(s.x - p.x, s.z - p.z) < room + s.r) return false;
    }
    return true;
  }
}

/** Points every `step` metres along a sagging run (its ends included), each as a post `r` round from `drop` under it to `r` over. */
export const runPosts = (point: (t: number) => { x: number; y: number; z: number }, length: number, r: number, drop: number, step = 0.5): AirPost[] => {
  const n = Math.max(1, Math.ceil(length / step));
  const out: AirPost[] = [];
  for (let k = 0; k <= n; k++) {
    const q = point(k / n);
    out.push({ x: q.x, z: q.z, r, bottom: q.y - r - drop, top: q.y + r });
  }
  return out;
};

/** A thin upright box as a prism: centre, unit direction of its width, half width and half depth (m). */
export const boxRing = (c: P2, dir: P2, hw: number, hd: number): P2[] => {
  const n = { x: -dir.z, z: dir.x };
  return [
    { x: c.x - dir.x * hw - n.x * hd, z: c.z - dir.z * hw - n.z * hd },
    { x: c.x + dir.x * hw - n.x * hd, z: c.z + dir.z * hw - n.z * hd },
    { x: c.x + dir.x * hw + n.x * hd, z: c.z + dir.z * hw + n.z * hd },
    { x: c.x - dir.x * hw + n.x * hd, z: c.z - dir.z * hw + n.z * hd },
  ];
};
