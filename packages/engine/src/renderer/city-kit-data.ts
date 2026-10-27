import type { BlockSkin, BlockStyle, BlockFront, Vec3 } from "@seki/core";

/**
 * The city kit (ADR-0022): buildings, vehicles and street props baked by tools/city_kit.py
 * into one GLB on a shared swatch palette, and the plan that dresses a collision box in them.
 * Pure data and geometry, no Babylon: the renderer turns the result into meshes.
 */

export interface KitSwatch {
  readonly name: string;
  readonly color: string;
  /** "lit": shaded; "tint": shaded and multiplied by the building's tint; "glow": self-lit. */
  readonly kind: "lit" | "tint" | "glow";
}

export interface KitModel {
  readonly key: string;
  /** Bounding box, metres; the model stands on y = 0, centred on X/Z, its front facing -Z. */
  readonly size: Vec3;
  /** Height of the main roof (parapets and roof housings stand above it). */
  readonly roof: number;
  readonly styles: readonly string[];
  /** Babylon space (left-handed): glTF Z negated. */
  readonly positions: Float32Array;
  readonly normals: Float32Array;
  readonly uvs: Float32Array;
  readonly indices: Uint32Array;
}

export interface CityKitData {
  readonly models: ReadonlyMap<string, KitModel>;
  readonly swatches: readonly KitSwatch[];
  /** Swatches per palette row (and rows). */
  readonly grid: number;
}

type Json = Record<string, unknown>;
const obj = (v: unknown): Json => (typeof v === "object" && v !== null ? (v as Json) : {});
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const num = (v: unknown, fallback = 0): number => (typeof v === "number" && Number.isFinite(v) ? v : fallback);

const COMPONENTS: Readonly<Record<string, number>> = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 };

/** Reads one accessor as floats (normalized integers scaled to [-1, 1] or [0, 1]). */
const readAccessor = (json: Json, bin: DataView, index: number): Float32Array => {
  const a = obj(arr(json.accessors)[index]);
  const view = obj(arr(json.bufferViews)[num(a.bufferView)]);
  const n = COMPONENTS[String(a.type)] ?? 1;
  const count = num(a.count);
  const type = num(a.componentType);
  const size = type === 5126 || type === 5125 ? 4 : type === 5122 || type === 5123 ? 2 : 1;
  const stride = num(view.byteStride) || n * size;
  const start = num(view.byteOffset) + num(a.byteOffset);
  const norm = a.normalized === true;
  const out = new Float32Array(count * n);
  for (let i = 0; i < count; i++) {
    for (let c = 0; c < n; c++) {
      const at = start + i * stride + c * size;
      let value: number;
      switch (type) {
        case 5126:
          value = bin.getFloat32(at, true);
          break;
        case 5125:
          value = bin.getUint32(at, true);
          break;
        case 5123:
          value = bin.getUint16(at, true);
          if (norm) value /= 65535;
          break;
        case 5122:
          value = bin.getInt16(at, true);
          if (norm) value = Math.max(-1, value / 32767);
          break;
        case 5121:
          value = bin.getUint8(at);
          if (norm) value /= 255;
          break;
        default:
          value = bin.getInt8(at);
          if (norm) value = Math.max(-1, value / 127);
      }
      out[i * n + c] = value;
    }
  }
  return out;
};

/** Parses city-kit.glb. Throws on anything that is not the kit's layout. */
export const parseCityKit = (bytes: ArrayBuffer): CityKitData => {
  const head = new DataView(bytes);
  if (bytes.byteLength < 28 || head.getUint32(0, true) !== 0x46546c67) throw new Error("city kit: not a GLB");
  const jsonLength = head.getUint32(12, true);
  const json = obj(JSON.parse(new TextDecoder().decode(new Uint8Array(bytes, 20, jsonLength))));
  const binStart = 20 + jsonLength;
  const bin = new DataView(bytes, binStart + 8, head.getUint32(binStart, true));
  const extras = obj(obj(json.asset).extras);
  const swatches = arr(extras.swatches).map((s): KitSwatch => {
    const o = obj(s);
    const kind = o.kind === "tint" || o.kind === "glow" ? o.kind : "lit";
    return { name: String(o.name), color: String(o.color), kind };
  });
  const models = new Map<string, KitModel>();
  for (const node of arr(json.nodes).map(obj)) {
    const mesh = obj(arr(json.meshes)[num(node.mesh, -1)]);
    const prim = obj(arr(mesh.primitives)[0]);
    const attrs = obj(prim.attributes);
    if (attrs.POSITION === undefined) continue;
    const positions = readAccessor(json, bin, num(attrs.POSITION));
    const normals = readAccessor(json, bin, num(attrs.NORMAL));
    const uvs = readAccessor(json, bin, num(attrs.TEXCOORD_0));
    const indices = Uint32Array.from(readAccessor(json, bin, num(prim.indices)));
    // glTF is right-handed: mirror Z. The mirror also flips the winding to Babylon's.
    for (let i = 2; i < positions.length; i += 3) {
      positions[i] = -(positions[i] ?? 0);
      normals[i] = -(normals[i] ?? 0);
    }
    const ex = obj(node.extras);
    const size = arr(ex.size).map((x) => num(x));
    const key = String(node.name);
    models.set(key, {
      key,
      size: { x: size[0] ?? 1, y: size[1] ?? 1, z: size[2] ?? 1 },
      roof: num(ex.roof, size[1] ?? 1),
      styles: arr(ex.styles).map(String),
      positions,
      normals,
      uvs,
      indices,
    });
  }
  return { models, swatches, grid: num(extras.grid, 16) };
};

/**
 * The kit's one texture: the swatch palette on top (each swatch a 64 x 16 block, so a model's
 * constant UVs always sample one exact colour) and the sign label atlas below it, drawn at
 * runtime. Rows go down from v = 0, like the canvas and the glTF image.
 */
export const KIT_TEXTURE = { width: 1024, paletteHeight: 256, atlasHeight: 512, height: 768 } as const;

/** Moves a palette UV of the GLB (the 16 x 16 swatch grid) into the kit texture. */
export const paletteV = (v: number): number => (v * KIT_TEXTURE.paletteHeight) / KIT_TEXTURE.height;

/** Moves an atlas UV (0 at the atlas top, 1 at its bottom) into the kit texture. */
export const atlasV = (v: number): number => (KIT_TEXTURE.paletteHeight + v * KIT_TEXTURE.atlasHeight) / KIT_TEXTURE.height;

/** Kit texture coordinates of a swatch's centre. */
export const swatchUv = (data: CityKitData, name: string): readonly [number, number] => {
  const i = Math.max(0, data.swatches.findIndex((s) => s.name === name));
  return [((i % data.grid) + 0.5) / data.grid, paletteV((Math.floor(i / data.grid) + 0.5) / data.grid)];
};

// ---------------------------------------------------------------- plan

/** Turn about Y that brings a model's front (-Z) to face `front`. */
export const FACING_TURN: Readonly<Record<BlockFront, number>> = { "z-": 0, "z+": Math.PI, "x+": -Math.PI / 2, "x-": Math.PI / 2 };

/** Babylon's rotation about Y (left-handed): -Z turns towards (-sin t, -cos t). */
export const turnXZ = (x: number, z: number, turn: number): readonly [number, number] => {
  const c = Math.cos(turn);
  const s = Math.sin(turn);
  return [x * c + z * s, -x * s + z * c];
};

/** One model placed in the world: scaled in its own frame, turned, then moved. */
export interface Placement {
  readonly key: string;
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly turn: number;
  readonly sx: number;
  readonly sy: number;
  readonly sz: number;
  readonly tint: string;
}

/** A box of decor in a block's frame (x along the facade, z out of it towards -z), turned with it. */
export interface DecorBox {
  readonly kind: "box";
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly w: number;
  readonly h: number;
  readonly d: number;
  readonly swatch: string;
}

/** A sagging cable between two points of the block's frame. */
export interface DecorCable {
  readonly kind: "cable";
  readonly from: Vec3;
  readonly to: Vec3;
  readonly sag: number;
}

/**
 * A lit sign of the block's frame: `blade` stands out of the facade (both faces readable),
 * `board` lies flat on it. Centre, width along its face, height.
 */
export interface DecorSign {
  readonly kind: "blade" | "board";
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly w: number;
  readonly h: number;
  readonly label: number;
}

export interface SkinPlan {
  readonly placements: readonly Placement[];
  readonly decor: readonly (DecorBox | DecorCable)[];
  readonly signs: readonly DecorSign[];
  /** Block frame: centre of the base and the turn of its front. */
  readonly origin: Vec3;
  readonly turn: number;
}

/** Labels of the generic shop signs: made-up shops, no real brands. Vertical ones read top-down. */
export const BLADE_LABELS = ["BAR", "RAMEN", "HOTEL", "SAKE", "PACHI", "DENKI", "24H", "SUSHI", "TATTOO", "CYBER", "MOTEL", "OPEN", "GAMES", "NOODLE", "CLUB", "IZAKAYA"] as const;
export const BOARD_LABELS = ["KARAOKE", "NET CAFE", "MAHJONG", "PARTS & REPAIR", "NOODLE BAR", "PAWN 24H", "CAPSULE", "ARCADE", "LAUNDRY", "MASSAGE", "IMPLANTS", "TAKOYAKI", "OKONOMI", "VIDEO", "LIQUOR", "CHROME"] as const;
export const SIGN_COLORS = ["#ff2e88", "#00e5ff", "#ffb000", "#39ff8a", "#b46cff", "#ff4040"] as const;

/** Neon colour of a label, baked into the atlas. */
export const signColor = (label: number, kind: "blade" | "board"): string => SIGN_COLORS[(label + (kind === "board" ? 3 : 0)) % SIGN_COLORS.length] ?? "#ffffff";

const WALL_TINTS: Readonly<Record<string, readonly string[]>> = {
  // Night concrete: grey-teal, grey-violet, rust; multiplied with the wall swatch (#b4bac4).
  building: ["#7d8996", "#8a7f99", "#6f8290", "#9a8578", "#6b8f92", "#857e92", "#8f959e", "#7f7488"],
  tower: ["#5e7590", "#52677c", "#6c7290", "#5a6a80"],
  car: ["#a8255f", "#178a90", "#c4c8d0", "#323a4c", "#d8a640", "#7c2430", "#5a6470"],
};

/** Small deterministic PRNG (mulberry32): the same block always gets the same look. */
export const prng = (seed: number): (() => number) => {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

export const seedOf = (center: Vec3): number => (Math.imul(Math.round(center.x * 10), 73856093) ^ Math.imul(Math.round(center.z * 10), 19349663) ^ Math.imul(Math.round(center.y * 10), 83492791)) >>> 0;

const pickOf = <T>(rand: () => number, items: readonly T[]): T => {
  const item = items[Math.floor(rand() * items.length)];
  if (item === undefined) throw new Error("empty pick");
  return item;
};

const VEHICLES: ReadonlySet<BlockStyle> = new Set(["van", "car", "wreck", "dumpster"]);

/** Which catalogue style fills the front row and the rows behind it. */
const POOLS: Readonly<Record<BlockStyle, { readonly front: string; readonly back: string }>> = {
  shop: { front: "shop", back: "tenement" },
  bar: { front: "shop", back: "tenement" },
  tenement: { front: "tenement", back: "tenement" },
  tower: { front: "tower", back: "tower" },
  van: { front: "van", back: "van" },
  car: { front: "car", back: "car" },
  wreck: { front: "wreck", back: "wreck" },
  dumpster: { front: "dumpster", back: "dumpster" },
};

const median = (xs: readonly number[]): number => {
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)] ?? 1;
};

/** Distortion of fitting a model into a tile: stretched windows read worse than deep ones. */
const fitCost = (m: KitModel, w: number, h: number, d: number): number =>
  Math.abs(Math.log(w / m.size.x)) + 1.5 * Math.abs(Math.log(h / m.roof)) + 0.4 * Math.abs(Math.log(d / m.size.z));

const FLOOR = 3.2;

/**
 * Dresses a collision box in kit models. The block's front row of tiles faces the street, rows
 * behind it fill the depth; every tile is scaled so the models fill the box exactly (the main
 * roof at the box's top), so the box itself can be hidden. Decor (AC units, a drain pipe,
 * cables over the street, signs) hangs on the front.
 */
export const planSkin = (data: CityKitData, skin: BlockSkin, size: Vec3, center: Vec3): SkinPlan | null => {
  const rand = prng(seedOf(center));
  const turn = FACING_TURN[skin.front];
  const alongX = skin.front === "z+" || skin.front === "z-";
  const W = alongX ? size.x : size.z;
  const D = alongX ? size.z : size.x;
  const H = size.y;
  const origin = { x: center.x, y: center.y - size.y / 2, z: center.z };
  const at = (lx: number, ly: number, lz: number, key: string, sx: number, sy: number, sz: number, tint: string): Placement => {
    const [wx, wz] = turnXZ(lx, lz, turn);
    return { key, x: origin.x + wx, y: origin.y + ly, z: origin.z + wz, turn, sx, sy, sz, tint };
  };
  const all = [...data.models.values()];
  const pool = (style: string) => all.filter((m) => m.styles.includes(style));
  const front = pool(POOLS[skin.style].front);
  if (front.length === 0) return null;

  if (VEHICLES.has(skin.style)) {
    const m = pickOf(rand, front);
    const tint = skin.style === "dumpster" ? "#ffffff" : pickOf(rand, WALL_TINTS.car ?? ["#ffffff"]);
    return { placements: [at(0, 0, 0, m.key, W / m.size.x, H / m.size.y, D / m.size.z, tint)], decor: [], signs: [], origin, turn };
  }

  const back = pool(POOLS[skin.style].back);
  const tints = WALL_TINTS[skin.style === "tower" ? "tower" : "building"] ?? ["#ffffff"];
  const nx = Math.max(1, Math.min(8, Math.round(W / median(front.map((m) => m.size.x)))));
  const nz = Math.max(1, Math.min(4, Math.round(D / median(front.map((m) => m.size.z)))));
  const tw = W / nx;
  const td = D / nz;
  const placements: Placement[] = [];
  const barTile = skin.style === "bar" ? Math.floor((nx - 1) / 2) : -1;
  const bar = all.find((m) => m.styles.includes("bar"));
  let previous = "";
  for (let j = 0; j < nz; j++) {
    for (let i = 0; i < nx; i++) {
      const lx = -W / 2 + (i + 0.5) * tw;
      // Row 0 is the front: towards local -z.
      const lz = -D / 2 + (j + 0.5) * td;
      let m: KitModel;
      if (j === 0 && i === barTile && bar) {
        m = bar;
      } else {
        const ranked = (j === 0 ? front : back.length > 0 ? back : front)
          .map((c) => ({ c, cost: fitCost(c, tw, H, td) }))
          .sort((a, b) => a.cost - b.cost);
        const best = ranked[0]?.cost ?? 0;
        const near = ranked.filter((r) => r.cost <= best + 0.35 && r.c.key !== previous);
        m = pickOf(rand, near.length > 0 ? near : ranked).c;
      }
      previous = m.key;
      placements.push(at(lx, 0, lz, m.key, tw / m.size.x, H / m.roof, td / m.size.z, pickOf(rand, tints)));
    }
  }

  const decor: (DecorBox | DecorCable)[] = [];
  const signs: DecorSign[] = [];
  const face = -D / 2;
  // AC units hanging under the windows, more on flats than on office towers.
  const acShare = skin.style === "tower" ? 0.12 : 0.32;
  for (let i = 0; i < nx; i++) {
    const x0 = -W / 2 + i * tw;
    for (let y = FLOOR + 0.9; y < H - 2; y += FLOOR) {
      if (rand() > acShare) continue;
      const x = x0 + 1 + rand() * Math.max(0.1, tw - 2);
      decor.push({ kind: "box", x, y, z: face - 0.27, w: 0.82, h: 0.55, d: 0.52, swatch: "ac" });
      decor.push({ kind: "box", x, y, z: face - 0.54, w: 0.6, h: 0.4, d: 0.03, swatch: "ac-grille" });
    }
  }
  // A drain pipe down one tile edge.
  const pipeX = -W / 2 + Math.floor(rand() * (nx + 1)) * tw;
  decor.push({ kind: "box", x: Math.max(-W / 2 + 0.2, Math.min(W / 2 - 0.2, pipeX)), y: H / 2, z: face - 0.1, w: 0.16, h: H, d: 0.16, swatch: "pipe" });
  // Signs: a blade sign out of the facade, boards over shop fronts.
  const ownSigns = skin.signs !== false;
  if (ownSigns && skin.style !== "tower" && rand() < (skin.style === "tenement" ? 0.6 : 0.9)) {
    const x = -W / 2 + (nx > 1 ? Math.floor(1 + rand() * (nx - 1)) * tw : W * (0.2 + 0.6 * rand()));
    const h = 2.6 + rand() * 1.4;
    const y = 4.2 + h / 2 + rand() * 1.5;
    if (y + h / 2 < H - 0.5) {
      decor.push({ kind: "box", x, y, z: face - 0.75, w: 0.1, h: h + 0.16, d: 1.0, swatch: "sign-back" });
      decor.push({ kind: "box", x, y: y + h / 2 + 0.25, z: face - 0.4, w: 0.06, h: 0.06, d: 0.8, swatch: "pipe" });
      signs.push({ kind: "blade", x, y, z: face - 0.75, w: 0.9, h, label: Math.floor(rand() * BLADE_LABELS.length) });
    }
  }
  if (ownSigns && (skin.style === "shop" || skin.style === "bar")) {
    for (let i = 0; i < nx; i++) {
      if (i === barTile || rand() > 0.55) continue;
      const w = Math.min(tw * 0.6, 4.2);
      signs.push({ kind: "board", x: -W / 2 + (i + 0.5) * tw, y: 3.5, z: face - 0.14, w, h: w / 4.5, label: Math.floor(rand() * BOARD_LABELS.length) });
    }
  }
  // Power and data lines over the street to the facades across it.
  if (skin.street !== undefined && skin.street > 2) {
    const count = 1 + Math.floor(rand() * 2) + (W > 14 ? 1 : 0);
    for (let k = 0; k < count; k++) {
      const x = -W / 2 + W * (0.1 + 0.8 * rand());
      const y = Math.min(H - 1, 5.5 + rand() * 5);
      decor.push({
        kind: "cable",
        from: { x, y, z: face - 0.05 },
        to: { x: x + (rand() - 0.5) * 6, y: y + (rand() - 0.5) * 2.5, z: face - skin.street },
        sag: 0.5 + rand() * 1.1,
      });
    }
  }
  return { placements, decor, signs, origin, turn };
};

// ---------------------------------------------------------------- geometry

/** Growing vertex arrays of one bucket mesh. */
export class GeometrySink {
  readonly positions: number[] = [];
  readonly normals: number[] = [];
  readonly uvs: number[] = [];
  readonly colors: number[] = [];
  readonly indices: number[] = [];

  get vertexCount(): number {
    return this.positions.length / 3;
  }

  /** A model scaled in its own frame, turned and moved; `tint` goes to the vertex colour. */
  addModel(m: KitModel, p: Placement): void {
    const base = this.vertexCount;
    const [r, g, b] = hexRgb(p.tint);
    const c = Math.cos(p.turn);
    const s = Math.sin(p.turn);
    for (let i = 0; i < m.positions.length; i += 3) {
      const x = (m.positions[i] ?? 0) * p.sx;
      const y = (m.positions[i + 1] ?? 0) * p.sy;
      const z = (m.positions[i + 2] ?? 0) * p.sz;
      this.positions.push(p.x + x * c + z * s, p.y + y, p.z - x * s + z * c);
      // Normals of a scaled shape: divide by the scale, then renormalize.
      let nx = (m.normals[i] ?? 0) / p.sx;
      let ny = (m.normals[i + 1] ?? 0) / p.sy;
      let nz = (m.normals[i + 2] ?? 0) / p.sz;
      const len = Math.hypot(nx, ny, nz) || 1;
      nx /= len;
      ny /= len;
      nz /= len;
      this.normals.push(nx * c + nz * s, ny, -nx * s + nz * c);
      this.colors.push(r, g, b, 1);
    }
    for (let i = 0; i < m.uvs.length; i += 2) this.uvs.push(m.uvs[i] ?? 0, paletteV(m.uvs[i + 1] ?? 0));
    for (const i of m.indices) this.indices.push(base + i);
  }

  /**
   * A quad from four corners in order around it, facing `n`. Babylon's front faces wind
   * clockwise seen from the front, so the order is fixed up from the normal.
   */
  quad(a: Vec3, b: Vec3, c: Vec3, d: Vec3, n: Vec3, uv: readonly [number, number] | readonly (readonly [number, number])[], tint: readonly [number, number, number] = [1, 1, 1]): void {
    const base = this.vertexCount;
    const corners = [a, b, c, d];
    corners.forEach((p, k) => {
      this.positions.push(p.x, p.y, p.z);
      this.normals.push(n.x, n.y, n.z);
      const t = (Array.isArray(uv[0]) ? (uv as readonly (readonly [number, number])[])[k] : (uv as readonly [number, number])) ?? [0, 0];
      this.uvs.push(t[0], t[1]);
      this.colors.push(tint[0], tint[1], tint[2], 1);
    });
    const e1 = { x: b.x - a.x, y: b.y - a.y, z: b.z - a.z };
    const e2 = { x: c.x - a.x, y: c.y - a.y, z: c.z - a.z };
    const cross = { x: e1.y * e2.z - e1.z * e2.y, y: e1.z * e2.x - e1.x * e2.z, z: e1.x * e2.y - e1.y * e2.x };
    const ccw = cross.x * n.x + cross.y * n.y + cross.z * n.z > 0;
    if (ccw) this.indices.push(base, base + 2, base + 1, base, base + 3, base + 2);
    else this.indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }

  /** An oriented box: centre, half extents along three orthonormal axes. */
  box(center: Vec3, axes: readonly [Vec3, Vec3, Vec3], half: readonly [number, number, number], uv: readonly [number, number]): void {
    const corner = (sx: number, sy: number, sz: number): Vec3 => ({
      x: center.x + axes[0].x * half[0] * sx + axes[1].x * half[1] * sy + axes[2].x * half[2] * sz,
      y: center.y + axes[0].y * half[0] * sx + axes[1].y * half[1] * sy + axes[2].y * half[2] * sz,
      z: center.z + axes[0].z * half[0] * sx + axes[1].z * half[1] * sy + axes[2].z * half[2] * sz,
    });
    const neg = (v: Vec3): Vec3 => ({ x: -v.x, y: -v.y, z: -v.z });
    const [ax, ay, az] = axes;
    this.quad(corner(1, -1, -1), corner(1, 1, -1), corner(1, 1, 1), corner(1, -1, 1), ax, uv);
    this.quad(corner(-1, -1, -1), corner(-1, -1, 1), corner(-1, 1, 1), corner(-1, 1, -1), neg(ax), uv);
    this.quad(corner(-1, 1, -1), corner(-1, 1, 1), corner(1, 1, 1), corner(1, 1, -1), ay, uv);
    this.quad(corner(-1, -1, -1), corner(1, -1, -1), corner(1, -1, 1), corner(-1, -1, 1), neg(ay), uv);
    this.quad(corner(-1, -1, 1), corner(1, -1, 1), corner(1, 1, 1), corner(-1, 1, 1), az, uv);
    this.quad(corner(-1, -1, -1), corner(-1, 1, -1), corner(1, 1, -1), corner(1, -1, -1), neg(az), uv);
  }
}

export const hexRgb = (hex: string): readonly [number, number, number] => {
  const n = parseInt(hex.slice(1, 7), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
};

/** World point of a block-frame point. */
export const toWorld = (plan: SkinPlan, p: Vec3): Vec3 => {
  const [x, z] = turnXZ(p.x, p.z, plan.turn);
  return { x: plan.origin.x + x, y: plan.origin.y + p.y, z: plan.origin.z + z };
};

const sub = (a: Vec3, b: Vec3): Vec3 => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
const unit = (v: Vec3): Vec3 => {
  const l = Math.hypot(v.x, v.y, v.z) || 1;
  return { x: v.x / l, y: v.y / l, z: v.z / l };
};
const cross = (a: Vec3, b: Vec3): Vec3 => ({ x: a.y * b.z - a.z * b.y, y: a.z * b.x - a.x * b.z, z: a.x * b.y - a.y * b.x });

/** Adds a plan's decor boxes and cables to a sink. */
export const addDecor = (sink: GeometrySink, data: CityKitData, plan: SkinPlan): void => {
  const [ax, az] = turnXZ(1, 0, plan.turn);
  const [fx, fz] = turnXZ(0, 1, plan.turn);
  const axes: [Vec3, Vec3, Vec3] = [
    { x: ax, y: 0, z: az },
    { x: 0, y: 1, z: 0 },
    { x: fx, y: 0, z: fz },
  ];
  for (const d of plan.decor) {
    if (d.kind === "box") {
      sink.box(toWorld(plan, d), axes, [d.w / 2, d.h / 2, d.d / 2], swatchUv(data, d.swatch));
      continue;
    }
    const uv = swatchUv(data, "cable");
    const a = toWorld(plan, d.from);
    const b = toWorld(plan, d.to);
    const segments = 8;
    let prev = a;
    for (let i = 1; i <= segments; i++) {
      const t = i / segments;
      const p = { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t - Math.sin(t * Math.PI) * d.sag, z: a.z + (b.z - a.z) * t };
      const dir = unit(sub(p, prev));
      const side = unit(Math.abs(dir.y) > 0.95 ? cross(dir, { x: 1, y: 0, z: 0 }) : cross(dir, { x: 0, y: 1, z: 0 }));
      const up = cross(side, dir);
      const mid = { x: (p.x + prev.x) / 2, y: (p.y + prev.y) / 2, z: (p.z + prev.z) / 2 };
      sink.box(mid, [side, up, dir], [0.018, 0.018, Math.hypot(p.x - prev.x, p.y - prev.y, p.z - prev.z) / 2 + 0.01], uv);
      prev = p;
    }
  }
};

/** Where a label sits in the sign atlas, as rectangles [u0, v0, u1, v1] of the atlas (v down, like the canvas). */
export interface SignAtlasLayout {
  readonly width: number;
  readonly height: number;
  readonly blade: (label: number) => readonly [number, number, number, number];
  readonly board: (label: number) => readonly [number, number, number, number];
}

/** Atlas: 16 vertical blade cells (64 x 256) on top, 16 board cells (256 x 64) below. */
export const SIGN_ATLAS: SignAtlasLayout = {
  width: 1024,
  height: 512,
  blade: (label) => {
    const i = label % 16;
    return [(i * 64) / 1024, 0, ((i + 1) * 64) / 1024, 0.5];
  },
  board: (label) => {
    const i = label % 16;
    const col = i % 4;
    const row = Math.floor(i / 4);
    return [(col * 256) / 1024, 0.5 + (row * 64) / 512, ((col + 1) * 256) / 1024, 0.5 + ((row + 1) * 64) / 512];
  },
};

/**
 * Adds a plan's signs to a sink, UVs into the sign atlas. Blades get a readable face on both
 * sides.
 */
export const addSigns = (sink: GeometrySink, plan: SkinPlan): void => {
  const [ax, az] = turnXZ(1, 0, plan.turn);
  const [fx, fz] = turnXZ(0, 1, plan.turn);
  const along = { x: ax, y: 0, z: az };
  // Out of the facade, towards the street (local -z).
  const out = { x: -fx, y: 0, z: -fz };
  for (const s of plan.signs) {
    const c = toWorld(plan, s);
    const pt = (u: number, v: number, w: number, axis: Vec3, n: Vec3): Vec3 => ({ x: c.x + axis.x * u + n.x * w, y: c.y + v, z: c.z + axis.z * u + n.z * w });
    if (s.kind === "board") {
      const [u0, c0, u1, c1] = SIGN_ATLAS.board(s.label);
      // v0 is the top of the label, v1 its bottom.
      const v0 = atlasV(c0);
      const v1 = atlasV(c1);
      const hw = s.w / 2;
      const hh = s.h / 2;
      // Seen from the street, the facade's +x runs to the right: the text reads along it.
      sink.quad(pt(-hw, -hh, 0, along, out), pt(hw, -hh, 0, along, out), pt(hw, hh, 0, along, out), pt(-hw, hh, 0, along, out), out, [
        [u0, v1],
        [u1, v1],
        [u1, v0],
        [u0, v0],
      ]);
      continue;
    }
    const [u0, c0, u1, c1] = SIGN_ATLAS.blade(s.label);
    const v0 = atlasV(c0);
    const v1 = atlasV(c1);
    const hw = s.w / 2;
    const hh = s.h / 2;
    // Both faces of the blade, each with the letters reading top-down and not mirrored.
    for (const side of [1, -1]) {
      const n = { x: along.x * side, y: 0, z: along.z * side };
      // The viewer's right on this face (Babylon is left-handed: right = up x forward).
      const right = { x: -out.x * side, y: 0, z: -out.z * side };
      sink.quad(pt(-hw, -hh, 0.055, right, n), pt(hw, -hh, 0.055, right, n), pt(hw, hh, 0.055, right, n), pt(-hw, hh, 0.055, right, n), n, [
        [u0, v1],
        [u1, v1],
        [u1, v0],
        [u0, v0],
      ]);
    }
  }
};
