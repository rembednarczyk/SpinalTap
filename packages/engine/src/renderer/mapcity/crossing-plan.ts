import { DRESS_FLAG, type MeshSink, hexColor } from "../mesh-sink";
import { type HeightAt, SURFACE_CODE, SURFACE_LIFT, drape } from "./ground-plan";
import { type Obb, type P2, obbLocal, orientedBox } from "./polygon";

/** Worn white road paint, wet like the asphalt under it. */
const PAINT = hexColor("#c9ccc6", DRESS_FLAG.wet);
/** Lublin 2077: a self-lit cyan line along both edges of the zebra, kerb to kerb (ADR-0052). */
const GLOW = hexColor("#2fc6e0", DRESS_FLAG.lit);
const GLOW_WIDTH = 0.07;
/** How far outside the band's long side the edge line's middle lies, metres. */
const GLOW_REACH = 0.12;

/** Width of a zebra's stripe and of the gap between two, metres (Polish P-10). */
export const ZEBRA_STRIPE = 0.5;
/** Stripes stop this short of the kerbs, metres. */
const KERB_GAP = 0.25;

/** `poly` clipped to the convex counter-clockwise `clip` (Sutherland–Hodgman): what of it lies inside. */
const clipToConvex = (poly: readonly P2[], clip: readonly P2[]): P2[] => {
  let out: P2[] = [...poly];
  for (let i = 0; i < clip.length && out.length > 0; i++) {
    const a = clip[i]!;
    const b = clip[(i + 1) % clip.length]!;
    const side = (p: P2): number => (b.x - a.x) * (p.z - a.z) - (b.z - a.z) * (p.x - a.x);
    const input = out;
    out = [];
    for (let k = 0; k < input.length; k++) {
      const p = input[k]!;
      const q = input[(k + 1) % input.length]!;
      const sp = side(p);
      const sq = side(q);
      if (sp >= 0) out.push(p);
      if (sp >= 0 !== sq >= 0) {
        const t = sp / (sp - sq);
        out.push({ x: p.x + (q.x - p.x) * t, z: p.z + (q.z - p.z) * t });
      }
    }
  }
  return out;
};

/** The ring counter-clockwise (positive area in x, z). */
const ccwRing = (ring: readonly P2[]): readonly P2[] => {
  let a = 0;
  for (let i = 0; i < ring.length; i++) {
    const p = ring[i]!;
    const q = ring[(i + 1) % ring.length]!;
    a += p.x * q.z - q.x * p.z;
  }
  return a >= 0 ? ring : [...ring].reverse();
};

/**
 * A piece of a band (counter-clockwise, in the band's frame `box`) with its corners on the band's long
 * sides moved out to `reach` along the piece's other edge there (the chunk's cut, or the band's short
 * side): the pieces of one band reached out so still meet edge to edge, and each draws its own stretch
 * of the edge lines outside the band.
 */
const reachOut = (piece: readonly P2[], box: Obb, reach: number, at: (u: number, v: number) => P2): P2[] => {
  const half = box.halfShort;
  const local = piece.map((p) => obbLocal(box, p));
  return local.map((p, i) => {
    if (Math.abs(Math.abs(p.v) - half) > ON_SIDE) return at(p.u, p.v);
    const q = [local[(i + local.length - 1) % local.length]!, local[(i + 1) % local.length]!].find((o) => Math.abs(o.v - p.v) > ON_SIDE);
    if (!q) return at(p.u, p.v);
    const target = Math.sign(p.v) * reach;
    const k = (target - p.v) / (p.v - q.v);
    return at(p.u + (p.u - q.u) * k, target);
  });
};

/** A corner within this of the band's long side lies on it (the importer rounds to a centimetre). */
const ON_SIDE = 0.02;

/**
 * A zebra crossing (ADR-0042) on its band across the carriageway: white stripes along the road,
 * `ZEBRA_STRIPE` wide with as wide a gap, repeated from kerb to kerb. The band's long side runs
 * across the road (the importer makes it as long as the road is wide and 3 m along it). Its two
 * edges glow cyan. A piece its chunk's edge cut from the band (`band`, G-958) is striped in the
 * whole band's frame, each stripe and edge line clipped to the piece, so the pieces of one zebra
 * line up into one.
 */
export const planCrossing = (sink: MeshSink, ring: readonly P2[], h: HeightAt, band?: readonly P2[]): void => {
  if (ring.length < 3) return;
  const box = orientedBox(band && band.length >= 3 ? band : ring);
  // The piece's own hull: a piece cut from a band by a chunk's straight edge is convex.
  const piece = band && band.length >= 3 ? ccwRing(ring) : null;
  const cut = (poly: readonly P2[]): P2[] => (piece ? clipToConvex(poly, piece) : [...poly]);
  const across = box.halfLong - KERB_GAP;
  const along = box.halfShort;
  if (across <= ZEBRA_STRIPE || along < 0.5) return;
  const at = (u: number, v: number): P2 => ({ x: box.cx + box.ux * u - box.uz * v, z: box.cz + box.uz * u + box.ux * v });
  // The edge lines lie just outside the band: they are clipped to the piece reached out past its long sides along its other edges.
  const glowPiece = piece ? reachOut(piece, box, along + 2 * GLOW_REACH, at) : null;
  const count = Math.floor((2 * across + ZEBRA_STRIPE) / (2 * ZEBRA_STRIPE));
  const start = -((count * 2 - 1) * ZEBRA_STRIPE) / 2;
  for (let k = 0; k < count; k++) {
    const u0 = start + k * 2 * ZEBRA_STRIPE;
    const u1 = u0 + ZEBRA_STRIPE;
    const stripe = cut([at(u0, -along), at(u1, -along), at(u1, along), at(u0, along)]);
    if (stripe.length < 3) continue;
    drape(sink, stripe, h, SURFACE_LIFT.crossing, PAINT, (p) => {
      const l = obbLocal(box, p);
      return [l.u, l.v];
    }, [SURFACE_CODE.road, 0]);
  }
  for (const side of [-1, 1]) {
    const v0 = side * (along + GLOW_REACH);
    const line = [at(-across, v0 - GLOW_WIDTH / 2), at(across, v0 - GLOW_WIDTH / 2), at(across, v0 + GLOW_WIDTH / 2), at(-across, v0 + GLOW_WIDTH / 2)];
    const edge = glowPiece ? clipToConvex(line, glowPiece) : line;
    if (edge.length < 3) continue;
    drape(sink, edge, h, SURFACE_LIFT.crossing, GLOW, (p) => [p.x, p.z], [SURFACE_CODE.road, 0]);
  }
};
