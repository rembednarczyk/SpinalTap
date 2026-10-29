import type { CrowdLook } from "./crowd-look";

/**
 * The resident's figure (ADR-0041): a low-poly body in eleven rigid parts, each in the frame of
 * its joint, with a colour and a paint flag per vertex (1 painted, 0 self-lit, as the dressing).
 * Pure data, no Babylon: `CrowdViews` poses the parts each frame and bakes every resident into
 * one mesh. Built once per look.
 */

export const PART = { pelvis: 0, torso: 1, head: 2, thighL: 3, shinL: 4, thighR: 5, shinR: 6, upperL: 7, foreL: 8, upperR: 9, foreR: 10 } as const;
export const PART_COUNT = 11;

/** Where the joints are, for a figure of this look (m). */
export interface PuppetDims {
  /** Hip pivot above the feet; the pelvis and the torso turn about it. */
  readonly hipY: number;
  readonly hipX: number;
  readonly thigh: number;
  readonly shin: number;
  /** Shoulder pivot above the hip pivot. */
  readonly shoulderY: number;
  readonly shoulderX: number;
  readonly upper: number;
  readonly fore: number;
  /** Base of the neck above the hip pivot. */
  readonly neckY: number;
}

export interface PuppetTemplate {
  readonly positions: Float32Array;
  readonly normals: Float32Array;
  readonly colors: Float32Array;
  readonly parts: Uint8Array;
  readonly indices: Uint32Array;
  readonly vertexCount: number;
  readonly dims: PuppetDims;
}

type V3 = readonly [number, number, number];
type Rgba = readonly [number, number, number, number];

const rgba = (hex: string, flag = 1): Rgba => {
  const n = parseInt(hex.slice(1, 7), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255, flag];
};

const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot = (a: V3, b: V3): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const norm = (a: V3): V3 => {
  const l = Math.hypot(a[0], a[1], a[2]) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
};

/** Growing arrays of one figure. */
class FigureBuilder {
  readonly pos: number[] = [];
  readonly nor: number[] = [];
  readonly col: number[] = [];
  readonly part: number[] = [];
  readonly idx: number[] = [];

  private vertex(p: V3, n: V3, part: number, c: Rgba): number {
    this.pos.push(p[0], p[1], p[2]);
    this.nor.push(n[0], n[1], n[2]);
    this.col.push(c[0], c[1], c[2], c[3]);
    this.part.push(part);
    return this.pos.length / 3 - 1;
  }

  /** A triangle facing `n` (Babylon's front faces wind clockwise seen from the front). */
  private tri(i: number, j: number, k: number, n: V3): void {
    const p = (v: number): V3 => [this.pos[v * 3] ?? 0, this.pos[v * 3 + 1] ?? 0, this.pos[v * 3 + 2] ?? 0];
    const c = cross(sub(p(j), p(i)), sub(p(k), p(i)));
    if (dot(c, n) > 0) this.idx.push(i, k, j);
    else this.idx.push(i, j, k);
  }

  /** A flat quad through four corners in order round it. */
  quad(part: number, c: Rgba, a: V3, b: V3, cc: V3, d: V3, outward: V3): void {
    const n = norm(cross(sub(b, a), sub(d, a)));
    const facing: V3 = dot(n, outward) >= 0 ? n : [-n[0], -n[1], -n[2]];
    const i = [a, b, cc, d].map((p) => this.vertex(p, facing, part, c));
    this.tri(i[0] as number, i[1] as number, i[2] as number, facing);
    this.tri(i[0] as number, i[2] as number, i[3] as number, facing);
  }

  /**
   * A tapered box from (w0, d0) at height y0 to (w1, d1) at y1, centred on (cx, cz); `dz1`
   * moves the top forward (a sloped back, a coat's flare). Six faces.
   */
  taper(part: number, c: Rgba, y0: number, w0: number, d0: number, y1: number, w1: number, d1: number, cx = 0, cz = 0, dz1 = 0): void {
    const b: V3[] = [
      [cx - w0 / 2, y0, cz - d0 / 2],
      [cx + w0 / 2, y0, cz - d0 / 2],
      [cx + w0 / 2, y0, cz + d0 / 2],
      [cx - w0 / 2, y0, cz + d0 / 2],
    ];
    const t: V3[] = [
      [cx - w1 / 2, y1, cz + dz1 - d1 / 2],
      [cx + w1 / 2, y1, cz + dz1 - d1 / 2],
      [cx + w1 / 2, y1, cz + dz1 + d1 / 2],
      [cx - w1 / 2, y1, cz + dz1 + d1 / 2],
    ];
    const mid: V3 = [cx, (y0 + y1) / 2, cz + dz1 / 2];
    for (let k = 0; k < 4; k++) {
      const k2 = (k + 1) % 4;
      const a = b[k] as V3;
      const bb = b[k2] as V3;
      const out = sub([(a[0] + bb[0]) / 2, mid[1], (a[2] + bb[2]) / 2], mid);
      this.quad(part, c, a, bb, t[k2] as V3, t[k] as V3, out);
    }
    this.quad(part, c, t[0] as V3, t[1] as V3, t[2] as V3, t[3] as V3, [0, 1, 0]);
    this.quad(part, c, b[0] as V3, b[1] as V3, b[2] as V3, b[3] as V3, [0, -1, 0]);
  }

  box(part: number, c: Rgba, cx: number, cy: number, cz: number, w: number, h: number, d: number): void {
    this.taper(part, c, cy - h / 2, w, d, cy + h / 2, w, d, cx, cz);
  }

  /** A low-poly ellipsoid with smooth normals; `to` < 1 keeps only its top (a cap of hair). */
  ellipsoid(part: number, c: Rgba, center: V3, r: V3, rings = 5, segs = 8, to = 1): void {
    const base = this.pos.length / 3;
    for (let i = 0; i <= rings; i++) {
      const v = to * (i / rings);
      const phi = v * Math.PI;
      for (let j = 0; j <= segs; j++) {
        const th = (j / segs) * Math.PI * 2;
        const n: V3 = [Math.sin(phi) * Math.cos(th), Math.cos(phi), Math.sin(phi) * Math.sin(th)];
        this.vertex([center[0] + n[0] * r[0], center[1] + n[1] * r[1], center[2] + n[2] * r[2]], norm([n[0] / r[0], n[1] / r[1], n[2] / r[2]]), part, c);
      }
    }
    for (let i = 0; i < rings; i++) {
      for (let j = 0; j < segs; j++) {
        const a = base + i * (segs + 1) + j;
        const b = a + segs + 1;
        const n = norm(sub(this.at(a), center));
        this.tri(a, b, a + 1, n);
        this.tri(a + 1, b, b + 1, n);
      }
    }
  }

  /** A cone opening downwards from `apex` (an umbrella's canopy), seen from above and below. */
  canopy(part: number, top: Rgba, under: Rgba, apex: V3, radius: number, drop: number, segs: number): void {
    for (const side of [1, -1]) {
      for (let j = 0; j < segs; j++) {
        const a0 = (j / segs) * Math.PI * 2;
        const a1 = ((j + 1) / segs) * Math.PI * 2;
        const p0: V3 = [apex[0] + Math.cos(a0) * radius, apex[1] - drop, apex[2] + Math.sin(a0) * radius];
        const p1: V3 = [apex[0] + Math.cos(a1) * radius, apex[1] - drop, apex[2] + Math.sin(a1) * radius];
        const n0 = norm(cross(sub(p1, apex), sub(p0, apex)));
        const up: V3 = n0[1] >= 0 ? n0 : [-n0[0], -n0[1], -n0[2]];
        const n: V3 = side > 0 ? up : [-up[0], -up[1], -up[2]];
        const c = side > 0 ? top : under;
        const i = [apex, p0, p1].map((p) => this.vertex(p, n, part, c));
        this.tri(i[0] as number, i[1] as number, i[2] as number, n);
      }
    }
  }

  /** A thin upright band round (cx, cz) between heights y0 and y1, seen from outside and inside. */
  band(part: number, c: Rgba, cx: number, cz: number, radius: number, y0: number, y1: number, segs: number): void {
    for (let j = 0; j < segs; j++) {
      const a0 = (j / segs) * Math.PI * 2;
      const a1 = ((j + 1) / segs) * Math.PI * 2;
      const p = (a: number, y: number): V3 => [cx + Math.cos(a) * radius, y, cz + Math.sin(a) * radius];
      const out: V3 = [Math.cos((a0 + a1) / 2), 0, Math.sin((a0 + a1) / 2)];
      this.quad(part, c, p(a0, y0), p(a1, y0), p(a1, y1), p(a0, y1), out);
      this.quad(part, c, p(a0, y0), p(a1, y0), p(a1, y1), p(a0, y1), [-out[0], 0, -out[2]]);
    }
  }

  private at(v: number): V3 {
    return [this.pos[v * 3] ?? 0, this.pos[v * 3 + 1] ?? 0, this.pos[v * 3 + 2] ?? 0];
  }
}

/** Joint positions of a figure `height` tall and `width` broad. */
export const puppetDims = (height: number, width: number): PuppetDims => {
  const s = height / 1.74;
  return { hipY: 0.92 * s, hipX: 0.09 * width * s, thigh: 0.44 * s, shin: 0.48 * s, shoulderY: 0.5 * s, shoulderX: 0.19 * width * s, upper: 0.28 * s, fore: 0.27 * s, neckY: 0.56 * s };
};

/** The hand of the arm holding an umbrella (puppet's left), in the torso's frame, at its fixed pose. */
export const UMBRELLA_ARM = { armX: -0.55, armZ: -0.1, elbow: -1.45 } as const;

const handOf = (d: PuppetDims): V3 => {
  // Upper arm turned by armX (negative: forward), the forearm folded up by the elbow.
  const a = UMBRELLA_ARM.armX;
  const e = a + UMBRELLA_ARM.elbow;
  const y = d.shoulderY - d.upper * Math.cos(a) - (d.fore + 0.04) * Math.cos(e);
  const z = -d.upper * Math.sin(a) - (d.fore + 0.04) * Math.sin(e);
  return [-d.shoulderX + 0.05, y, z];
};

const legs = (f: FigureBuilder, d: PuppetDims, look: CrowdLook, s: number): void => {
  const bottom = rgba(look.colors.bottom);
  const shoes = rgba(look.colors.shoes);
  const w = look.width;
  for (const [thigh, shin] of [
    [PART.thighL, PART.shinL],
    [PART.thighR, PART.shinR],
  ] as const) {
    f.taper(thigh, bottom, -d.thigh, 0.1 * s * w, 0.11 * s, 0.02, 0.15 * s * w, 0.16 * s);
    f.taper(shin, bottom, -d.shin + 0.06 * s, 0.085 * s, 0.09 * s, 0.02, 0.1 * s, 0.11 * s);
    f.box(shin, shoes, 0, -d.shin + 0.035 * s, 0.04 * s, 0.1 * s, 0.07 * s, 0.25 * s);
  }
};

const arms = (f: FigureBuilder, d: PuppetDims, look: CrowdLook, s: number): void => {
  const top = rgba(look.colors.top);
  const skin = rgba(look.colors.skin);
  const trim = rgba(look.colors.accent, 0);
  for (const [upper, fore, side] of [
    [PART.upperL, PART.foreL, -1],
    [PART.upperR, PART.foreR, 1],
  ] as const) {
    f.taper(upper, top, -d.upper, 0.075 * s, 0.08 * s, 0.03, 0.1 * s, 0.105 * s);
    f.taper(fore, top, -d.fore + 0.02, 0.065 * s, 0.07 * s, 0.02, 0.08 * s, 0.085 * s);
    f.box(fore, skin, 0, -d.fore - 0.03 * s, 0.005, 0.06 * s, 0.09 * s, 0.035 * s);
    if (look.trim) f.box(upper, trim, side * 0.045 * s, -d.upper * 0.5, 0, 0.012, d.upper * 0.8, 0.03);
  }
};

const torso = (f: FigureBuilder, d: PuppetDims, look: CrowdLook, s: number): void => {
  const w = look.width;
  const top = rgba(look.colors.top);
  const bottom = rgba(look.colors.bottom);
  const chest = look.female ? 0.25 : 0.27;
  f.taper(PART.pelvis, bottom, -0.07 * s, 0.3 * s * w, 0.18 * s, 0.1 * s, 0.31 * s * w, 0.19 * s);
  f.taper(PART.torso, top, 0.06 * s, 0.3 * s * w, 0.19 * s, d.shoulderY - 0.1 * s, 2 * chest * s * w * 0.78, 0.22 * s);
  f.taper(PART.torso, top, d.shoulderY - 0.1 * s, 2 * chest * s * w * 0.78, 0.22 * s, d.shoulderY + 0.05 * s, 0.24 * s * w, 0.17 * s);
  if (look.garment === "coat") f.taper(PART.torso, top, -0.42 * s, 0.44 * s * w, 0.3 * s, d.shoulderY - 0.02, 0.36 * s * w, 0.24 * s);
  if (look.garment === "skirt") f.taper(PART.pelvis, top, -0.32 * s, 0.4 * s * w, 0.3 * s, 0.06 * s, 0.31 * s * w, 0.2 * s);
  if (look.trim) f.box(PART.torso, rgba(look.colors.accent, 0), 0, d.shoulderY - 0.16 * s, 0.115 * s, 0.3 * s * w, 0.02, 0.01);
  if (look.bag) f.box(PART.torso, rgba(look.colors.bag), 0, d.shoulderY - 0.2 * s, -0.17 * s, 0.26 * s * w, 0.32 * s, 0.12 * s);
};

const head = (f: FigureBuilder, look: CrowdLook, s: number): void => {
  const skin = rgba(look.colors.skin);
  const hair = rgba(look.colors.hair);
  const eyes = rgba("#14161c");
  f.taper(PART.head, skin, -0.02, 0.08 * s, 0.08 * s, 0.07 * s, 0.07 * s, 0.07 * s);
  const c: V3 = [0, 0.15 * s, 0.01];
  f.ellipsoid(PART.head, skin, c, [0.09 * s, 0.11 * s, 0.1 * s]);
  // Eyes: the face reads at a glance which way a figure looks.
  for (const x of [-0.034, 0.034]) f.box(PART.head, eyes, x * s, c[1] + 0.012 * s, c[2] + 0.094 * s, 0.022 * s, 0.014 * s, 0.012);
  // Hair: a cap over the crown and the back of the head, pushed back off the face.
  const cap = (grow: number, to: number): void => f.ellipsoid(PART.head, hair, [0, c[1] + 0.012 * s, c[2] - 0.022 * s], [(0.098 + grow) * s, (0.112 + grow) * s, (0.104 + grow) * s], 3, 8, to);
  switch (look.hair) {
    case "short":
      cap(0, 0.5);
      break;
    case "long":
      cap(0.004, 0.55);
      f.box(PART.head, hair, 0, c[1] - 0.08 * s, c[2] - 0.075 * s, 0.18 * s, 0.26 * s, 0.06 * s);
      break;
    case "bun":
      cap(0, 0.5);
      f.ellipsoid(PART.head, hair, [0, c[1] + 0.09 * s, c[2] - 0.08 * s], [0.05 * s, 0.05 * s, 0.05 * s], 3, 6);
      break;
    case "hood":
      f.ellipsoid(PART.head, hair, [0, c[1] + 0.012 * s, c[2] - 0.035 * s], [0.125 * s, 0.135 * s, 0.125 * s], 4, 8, 0.72);
      break;
    case "cap":
      cap(0.006, 0.42);
      f.box(PART.head, hair, 0, c[1] + 0.045 * s, c[2] + 0.1 * s, 0.15 * s, 0.015, 0.09 * s);
      break;
  }
};

const umbrella = (f: FigureBuilder, d: PuppetDims, look: CrowdLook): void => {
  const hand = handOf(d);
  const pole = rgba("#2b2e35");
  const top = 2.02 - d.hipY;
  const apex: V3 = [hand[0] + 0.06, top + 0.06, hand[2] - 0.02];
  f.box(PART.torso, pole, hand[0] + 0.03, (hand[1] + top) / 2, hand[2] - 0.01, 0.022, top - hand[1], 0.022);
  const color = rgba(look.colors.umbrella);
  const under = rgba(look.colors.umbrella);
  f.canopy(PART.torso, color, [under[0] * 0.6, under[1] * 0.6, under[2] * 0.6, 1], apex, 0.56, 0.2, 10);
  // An LED rim: a thin self-lit band along the canopy's edge.
  if (look.ledUmbrella) f.band(PART.torso, rgba(look.colors.accent, 0), apex[0], apex[2], 0.565, apex[1] - 0.215, apex[1] - 0.185, 10);
};

/** The figure of `look`, with or without an umbrella in its left hand. */
export const buildPuppet = (look: CrowdLook, withUmbrella: boolean): PuppetTemplate => {
  const s = look.height / 1.74;
  const d = puppetDims(look.height, look.width);
  const f = new FigureBuilder();
  legs(f, d, look, s);
  torso(f, d, look, s);
  arms(f, d, look, s);
  head(f, look, s);
  if (withUmbrella) umbrella(f, d, look);
  // The head's parts were laid out from the neck; torso parts from the hip pivot.
  return {
    positions: Float32Array.from(f.pos),
    normals: Float32Array.from(f.nor),
    colors: Float32Array.from(f.col),
    parts: Uint8Array.from(f.part),
    indices: Uint32Array.from(f.idx),
    vertexCount: f.pos.length / 3,
    dims: d,
  };
};
