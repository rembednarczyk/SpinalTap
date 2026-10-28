import type { BlockSkin, EntityId, Vec3 } from "@seki/core";
import { Color3, Constants, type GlowLayer, type Mesh, MeshClass, RawTexture, type Scene, type ShaderMaterial, VertexData } from "../babylon";
import type { ToonMaterials } from "../npr/toon-material";
import {
  BLADE_LABELS,
  BOARD_LABELS,
  type CityKitData,
  GeometrySink,
  KIT_TEXTURE,
  SIGN_ATLAS,
  addDecor,
  addSigns,
  hexRgb,
  parseCityKit,
  planSkin,
  signColor,
} from "./city-kit-data";

/** Side of the square cells the city is cut into: one mesh, so one draw call per pass, per cell. */
export const CITY_BUCKET = 64;

interface Member {
  readonly skin: BlockSkin;
  readonly size: Vec3;
  readonly center: Vec3;
  /** The collision box drawn while the kit is not there. */
  readonly box: Mesh | null;
}

interface Bucket {
  readonly members: Map<EntityId, Member>;
  mesh: Mesh | null;
  dirty: boolean;
}

export interface CityKitOptions {
  /**
   * Draws the sign labels into the kit texture. Needs a 2D canvas, which unit tests do not
   * have: without it the signs are blank boards.
   */
  readonly labels?: boolean;
  /** Called when a block's box gives way to the kit (the renderer hides it and steps it back). */
  readonly onCovered?: (box: Mesh) => void;
  /**
   * Is the roof of this block walked on (ADR-0027, C8)? Asked when its cell is built: walked
   * roofs get models without tall roof parts and lose their roof housings.
   */
  readonly walkedRoof?: (center: Vec3, size: Vec3) => boolean;
}

/** RGBA pixels of the sign label atlas (black boards, neon letters), or null without a canvas. */
const drawAtlas = (): Uint8ClampedArray | null => {
  if (typeof document === "undefined") return null;
  const width = KIT_TEXTURE.width;
  const height = KIT_TEXTURE.atlasHeight;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.fillStyle = "#06070b";
  ctx.fillRect(0, 0, width, height);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const cell = (r: readonly [number, number, number, number]) => ({ x: r[0] * width, y: r[1] * height, w: (r[2] - r[0]) * width, h: (r[3] - r[1]) * height });
  BLADE_LABELS.forEach((label, i) => {
    const { x, y, w, h } = cell(SIGN_ATLAS.blade(i));
    ctx.strokeStyle = ctx.fillStyle = signColor(i, "blade");
    ctx.lineWidth = 3;
    ctx.strokeRect(x + 5, y + 5, w - 10, h - 10);
    const letters = [...label];
    const size = Math.min(42, (h - 24) / letters.length);
    ctx.font = `bold ${size}px "Rajdhani", "Arial Narrow", sans-serif`;
    const top = y + (h - size * letters.length) / 2;
    letters.forEach((ch, k) => ctx.fillText(ch, x + w / 2, top + size * (k + 0.55)));
  });
  BOARD_LABELS.forEach((label, i) => {
    const { x, y, w, h } = cell(SIGN_ATLAS.board(i));
    ctx.strokeStyle = ctx.fillStyle = signColor(i, "board");
    ctx.lineWidth = 3;
    ctx.strokeRect(x + 5, y + 5, w - 10, h - 10);
    ctx.font = `bold 36px "Rajdhani", "Arial Narrow", sans-serif`;
    ctx.fillText(label, x + w / 2, y + h / 2 + 2, w - 24);
  });
  return ctx.getImageData(0, 0, width, height).data;
};

/**
 * The kit texture and its glow twin: palette swatches on top, the label atlas below. Alpha of
 * the colour texture tells the toon shader how to light a texel (ADR-0022): 255 lit, 128 lit
 * and tinted, 0 self-lit. The glow texture keeps only what shines.
 */
const kitTextures = (data: CityKitData, labels: boolean): { color: Uint8Array; glow: Uint8Array } => {
  const { width, height, paletteHeight } = KIT_TEXTURE;
  const color = new Uint8Array(width * height * 4);
  const glow = new Uint8Array(width * height * 4);
  const cw = width / data.grid;
  const ch = paletteHeight / data.grid;
  data.swatches.forEach((s, i) => {
    const rgb = hexRgb(s.color).map((c) => Math.round(c * 255));
    // Storefront glass fills whole walls: it blooms far less than a window or a neon tube, and
    // alpha just above 0 tells the shader to draw frames and shelving into it (ADR-0027, C1).
    const shop = s.name.startsWith("shop-");
    const alpha = s.kind === "lit" ? 255 : s.kind === "tint" ? 128 : shop ? 40 : 0;
    const bloom = shop ? 0.25 : 1;
    const x0 = (i % data.grid) * cw;
    const y0 = Math.floor(i / data.grid) * ch;
    for (let y = y0; y < y0 + ch; y++) {
      for (let x = x0; x < x0 + cw; x++) {
        const o = (y * width + x) * 4;
        color.set([rgb[0] ?? 0, rgb[1] ?? 0, rgb[2] ?? 0, alpha], o);
        if (s.kind === "glow") glow.set([...rgb.map((c) => Math.round(c * bloom)), 255], o);
      }
    }
  });
  const atlas = labels ? drawAtlas() : null;
  for (let i = 0; i < width * KIT_TEXTURE.atlasHeight; i++) {
    const o = (paletteHeight * width + i) * 4;
    const r = atlas?.[i * 4] ?? 6;
    const g = atlas?.[i * 4 + 1] ?? 7;
    const b = atlas?.[i * 4 + 2] ?? 11;
    color.set([r, g, b, 0], o);
    glow.set([r, g, b, 255], o);
  }
  for (let o = 3; o < glow.length; o += 4) glow[o] = 255;
  return { color, glow };
};

/**
 * Draws skinned blocks (ADR-0022) from the city kit: every building, vehicle, its decor and
 * its signs in a 64 m cell are baked into one mesh on the kit texture, so a cell costs one
 * draw call per pass. Cells rebuild lazily, once per frame at most, when blocks stream in or
 * out; their collision boxes stay in the scene, hidden (they still block the camera and cast
 * the moon shadow).
 */
export class CityKit {
  private readonly buckets = new Map<string, Bucket>();
  private readonly where = new Map<EntityId, string>();
  readonly material: ShaderMaterial;
  private readonly glowColor = new Color3(1, 1, 1);

  constructor(
    private readonly scene: Scene,
    materials: ToonMaterials,
    private readonly glow: GlowLayer | null,
    readonly data: CityKitData,
    private readonly options: CityKitOptions = {},
  ) {
    const { color, glow: lit } = kitTextures(data, this.options.labels !== false);
    const make = (pixels: Uint8Array) =>
      new RawTexture(pixels, KIT_TEXTURE.width, KIT_TEXTURE.height, Constants.TEXTUREFORMAT_RGBA, scene, true, false, Constants.TEXTURE_TRILINEAR_SAMPLINGMODE);
    this.material = materials.forCityKit(make(color));
    // The glow layer reads `emissiveTexture` and `emissiveColor` off any material: only
    // windows, neon and sign letters bloom; the rest of the cell renders black into the glow map.
    Object.assign(this.material, { emissiveTexture: make(lit), emissiveColor: this.glowColor });
    this.setDaylight(0);
  }

  /** Fetches and parses the kit. */
  static async load(url: string): Promise<CityKitData> {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`city kit ${url}: ${res.status}`);
    const data = parseCityKit(await res.arrayBuffer());
    // The sign labels are drawn with the UI font.
    if (typeof document !== "undefined") await document.fonts.ready;
    return data;
  }

  /** Dresses a block; false if the kit has nothing for its style. The box is hidden once its cell is built. */
  add(id: EntityId, skin: BlockSkin, size: Vec3, center: Vec3, box: Mesh | null): boolean {
    this.remove(id);
    if (!planSkin(this.data, skin, size, center)) return false;
    const key = `${Math.floor(center.x / CITY_BUCKET)}:${Math.floor(center.z / CITY_BUCKET)}`;
    let bucket = this.buckets.get(key);
    if (!bucket) {
      bucket = { members: new Map(), mesh: null, dirty: true };
      this.buckets.set(key, bucket);
    }
    bucket.members.set(id, { skin, size, center: { x: center.x, y: center.y, z: center.z }, box });
    bucket.dirty = true;
    this.where.set(id, key);
    return true;
  }

  remove(id: EntityId): void {
    const key = this.where.get(id);
    if (key === undefined) return;
    this.where.delete(id);
    const bucket = this.buckets.get(key);
    if (!bucket) return;
    bucket.members.delete(id);
    bucket.dirty = true;
  }

  /** Something changed near this point (a ladder or a rail on a roof): rebuild its cells. */
  touch(x: number, z: number): void {
    for (const dx of [-2, 2]) {
      for (const dz of [-2, 2]) {
        const bucket = this.buckets.get(`${Math.floor((x + dx) / CITY_BUCKET)}:${Math.floor((z + dz) / CITY_BUCKET)}`);
        if (bucket) bucket.dirty = true;
      }
    }
  }

  has(id: EntityId): boolean {
    return this.where.has(id);
  }

  /** Rebuilds the cells whose blocks changed. Call once per frame before rendering. */
  flush(): void {
    for (const [key, bucket] of this.buckets) {
      if (!bucket.dirty) continue;
      bucket.dirty = false;
      bucket.mesh?.dispose(false, false);
      bucket.mesh = null;
      if (bucket.members.size === 0) {
        this.buckets.delete(key);
        continue;
      }
      const sink = new GeometrySink();
      for (const id of [...bucket.members.keys()].sort((a, b) => a - b)) {
        const m = bucket.members.get(id);
        if (!m) continue;
        const walked = this.options.walkedRoof?.(m.center, m.size) ?? false;
        const plan = planSkin(this.data, m.skin, m.size, m.center, { walkedRoof: walked });
        if (!plan) continue;
        for (const p of plan.placements) {
          const model = this.data.models.get(p.key);
          if (model) sink.addModel(model, p, walked);
        }
        addDecor(sink, this.data, plan);
        addSigns(sink, plan);
        if (m.box && m.box.isVisible) {
          m.box.isVisible = false;
          this.options.onCovered?.(m.box);
        }
      }
      bucket.mesh = this.mesh(`city-${key}`, sink);
    }
  }

  /** Daylight 0..1 (ADR-0017): lit windows and neon dim by day. */
  setDaylight(daylight: number): void {
    const t = Math.max(0, Math.min(1, daylight));
    this.material.setFloat("selfLit", 1 - 0.5 * t);
    const g = 0.55 * (1 - 0.7 * t);
    this.glowColor.set(g, g, g);
  }

  /** Cell meshes currently built. */
  get meshCount(): number {
    let n = 0;
    for (const b of this.buckets.values()) n += b.mesh ? 1 : 0;
    return n;
  }

  private mesh(name: string, sink: GeometrySink): Mesh {
    const data = new VertexData();
    data.positions = sink.positions;
    data.normals = sink.normals;
    data.uvs = sink.uvs;
    data.colors = sink.colors;
    data.indices = sink.indices;
    const mesh = new MeshClass(name, this.scene);
    data.applyToMesh(mesh, false);
    mesh.material = this.material;
    mesh.isPickable = false;
    mesh.freezeWorldMatrix();
    this.glow?.addIncludedOnlyMesh(mesh);
    return mesh;
  }
}
