/**
 * Growing vertex arrays for procedural set dressing and the far city (ADR-0027): boxes, prisms
 * and quads with a colour per vertex and two UV channels, baked straight into world space. Pure
 * data, no Babylon, so plans can be tested without a scene; `applyToMesh` turns one into a mesh.
 */

export type Rgba = readonly [number, number, number, number];

export interface Vec {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

/** Vertex alpha flags of the dressing material (toon shader, DRESSING define). */
export const DRESS_FLAG = {
  /** Ordinary painted surface. */
  solid: 1,
  /** Wet: puddles and the deck's asphalt catch the street lights like glass. */
  wet: 0.5,
  /** Self-lit: neon tubes, road studs, vending machine fronts. */
  lit: 0,
} as const;

export const hexColor = (hex: string, alpha: number = DRESS_FLAG.solid): Rgba => {
  const n = parseInt(hex.slice(1, 7), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255, alpha];
};

export class MeshSink {
  readonly positions: number[] = [];
  readonly normals: number[] = [];
  readonly colors: number[] = [];
  readonly uvs: number[] = [];
  readonly uvs2: number[] = [];
  readonly indices: number[] = [];

  get vertexCount(): number {
    return this.positions.length / 3;
  }

  get empty(): boolean {
    return this.indices.length === 0;
  }

  /**
   * A quad from four corners in order around it, facing `n`; the winding is fixed up from the
   * normal (Babylon's front faces wind clockwise seen from the front).
   */
  quad(corners: readonly [Vec, Vec, Vec, Vec], n: Vec, color: Rgba, uv: readonly [number, number][] = QUAD_UV, uv2: readonly [number, number] = [0, 0]): void {
    const base = this.vertexCount;
    corners.forEach((p, k) => {
      this.positions.push(p.x, p.y, p.z);
      this.normals.push(n.x, n.y, n.z);
      this.colors.push(color[0], color[1], color[2], color[3]);
      const t = uv[k] ?? [0, 0];
      this.uvs.push(t[0], t[1]);
      this.uvs2.push(uv2[0], uv2[1]);
    });
    const [a, b, c] = corners;
    const e1 = { x: b.x - a.x, y: b.y - a.y, z: b.z - a.z };
    const e2 = { x: c.x - a.x, y: c.y - a.y, z: c.z - a.z };
    const cr = { x: e1.y * e2.z - e1.z * e2.y, y: e1.z * e2.x - e1.x * e2.z, z: e1.x * e2.y - e1.y * e2.x };
    const ccw = cr.x * n.x + cr.y * n.y + cr.z * n.z > 0;
    if (ccw) this.indices.push(base, base + 2, base + 1, base, base + 3, base + 2);
    else this.indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }

  /**
   * A box centred at `c` with full sizes w (local x), h (y), d (local z), turned `rotY` about Y
   * and tilted `tilt` about its local z axis (awnings). `skip` leaves out faces nobody sees
   * (the bottom of things standing on the ground).
   */
  box(c: Vec, w: number, h: number, d: number, color: Rgba, opts: { rotY?: number; tilt?: number; uv2?: readonly [number, number]; bottom?: boolean } = {}): void {
    const cy = Math.cos(opts.rotY ?? 0);
    const sy = Math.sin(opts.rotY ?? 0);
    const ct = Math.cos(opts.tilt ?? 0);
    const st = Math.sin(opts.tilt ?? 0);
    // Local axes: tilt about local z, then turn about Y (Babylon, left-handed: x' = x cos + z sin).
    const ax: Vec = { x: ct * cy, y: st, z: -ct * sy };
    const ay: Vec = { x: -st * cy, y: ct, z: st * sy };
    const az: Vec = { x: sy, y: 0, z: cy };
    const hw = w / 2;
    const hh = h / 2;
    const hd = d / 2;
    const p = (sx: number, sy2: number, sz: number): Vec => ({
      x: c.x + ax.x * hw * sx + ay.x * hh * sy2 + az.x * hd * sz,
      y: c.y + ax.y * hw * sx + ay.y * hh * sy2 + az.y * hd * sz,
      z: c.z + ax.z * hw * sx + ay.z * hh * sy2 + az.z * hd * sz,
    });
    const neg = (v: Vec): Vec => ({ x: -v.x, y: -v.y, z: -v.z });
    const uv2 = opts.uv2 ?? [0, 0];
    this.quad([p(1, -1, -1), p(1, 1, -1), p(1, 1, 1), p(1, -1, 1)], ax, color, QUAD_UV, uv2);
    this.quad([p(-1, -1, -1), p(-1, -1, 1), p(-1, 1, 1), p(-1, 1, -1)], neg(ax), color, QUAD_UV, uv2);
    this.quad([p(-1, 1, -1), p(-1, 1, 1), p(1, 1, 1), p(1, 1, -1)], ay, color, QUAD_UV, uv2);
    if (opts.bottom !== false) this.quad([p(-1, -1, -1), p(1, -1, -1), p(1, -1, 1), p(-1, -1, 1)], neg(ay), color, QUAD_UV, uv2);
    this.quad([p(-1, -1, 1), p(1, -1, 1), p(1, 1, 1), p(-1, 1, 1)], az, color, QUAD_UV, uv2);
    this.quad([p(-1, -1, -1), p(-1, 1, -1), p(1, 1, -1), p(1, -1, -1)], neg(az), color, QUAD_UV, uv2);
  }

  /** An upright n-sided prism (pipes, tanks, poles): centre of its base, radius, height. */
  prism(base: Vec, radius: number, h: number, sides: number, color: Rgba, cap = true, topRadius = radius): void {
    for (let i = 0; i < sides; i++) {
      const a0 = (i / sides) * Math.PI * 2;
      const a1 = ((i + 1) / sides) * Math.PI * 2;
      const am = (a0 + a1) / 2;
      const n = { x: Math.cos(am), y: 0, z: Math.sin(am) };
      const b0 = { x: base.x + Math.cos(a0) * radius, y: base.y, z: base.z + Math.sin(a0) * radius };
      const b1 = { x: base.x + Math.cos(a1) * radius, y: base.y, z: base.z + Math.sin(a1) * radius };
      const t0 = { x: base.x + Math.cos(a0) * topRadius, y: base.y + h, z: base.z + Math.sin(a0) * topRadius };
      const t1 = { x: base.x + Math.cos(a1) * topRadius, y: base.y + h, z: base.z + Math.sin(a1) * topRadius };
      this.quad([b0, b1, t1, t0], n, color);
      if (cap && topRadius > 0.001) this.quad([{ x: base.x, y: base.y + h, z: base.z }, t0, t1, { x: base.x, y: base.y + h, z: base.z }], { x: 0, y: 1, z: 0 }, color);
    }
  }

  /** A flat ellipse lying on the ground (puddles, oil stains). */
  disc(c: Vec, rx: number, rz: number, sides: number, color: Rgba): void {
    for (let i = 0; i < sides; i++) {
      const a0 = (i / sides) * Math.PI * 2;
      const a1 = ((i + 1) / sides) * Math.PI * 2;
      const p0 = { x: c.x + Math.cos(a0) * rx, y: c.y, z: c.z + Math.sin(a0) * rz };
      const p1 = { x: c.x + Math.cos(a1) * rx, y: c.y, z: c.z + Math.sin(a1) * rz };
      this.quad([c, p0, p1, c], { x: 0, y: 1, z: 0 }, color);
    }
  }

  /** A sagging cable between two points as a chain of thin boxes. */
  cable(a: Vec, b: Vec, sag: number, color: Rgba, thickness = 0.035): void {
    const segments = 8;
    let prev = a;
    for (let i = 1; i <= segments; i++) {
      const t = i / segments;
      const p = { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t - Math.sin(t * Math.PI) * sag, z: a.z + (b.z - a.z) * t };
      const mid = { x: (p.x + prev.x) / 2, y: (p.y + prev.y) / 2, z: (p.z + prev.z) / 2 };
      const dx = p.x - prev.x;
      const dy = p.y - prev.y;
      const dz = p.z - prev.z;
      const flat = Math.hypot(dx, dz);
      // Length along local x: turn to the segment's heading, tilt to its slope.
      this.box(mid, Math.hypot(flat, dy) + 0.01, thickness, thickness, color, { rotY: Math.atan2(-dz, dx), tilt: Math.atan2(dy, flat) });
      prev = p;
    }
  }
}

const QUAD_UV: [number, number][] = [
  [0, 0],
  [1, 0],
  [1, 1],
  [0, 1],
];
