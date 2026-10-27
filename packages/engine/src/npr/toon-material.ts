import { type BaseTexture, Color3, Matrix, type Scene, ShaderMaterial, type Texture } from "../babylon";
import { NIGHT_RIG, type LightingRig, type PointLightDef } from "./lighting";
import { PRESETS, type PresetName, type ToonPreset } from "./presets";
import { MAX_POINT_LIGHTS, TOON_FRAGMENT, TOON_VERTEX } from "./toon-shader";

const UNIFORMS = [
  "world",
  "viewProjection",
  "shadowMatrix",
  "shadowParams",
  "shadeColor",
  "fill",
  "fillColor",
  "flashLight",
  "cameraPosition",
  "baseColor",
  "emissiveColor",
  "sunDir",
  "sunColor",
  "ambientColor",
  "rimColor",
  "rimStrength",
  "gloss",
  "windows",
  "fogColor",
  "fogDensity",
  "pointPos",
  "pointColor",
  "pointCount",
];

const hex = (h: string): Color3 => Color3.FromHexString(h);

const SAMPLERS = ["shadowSampler", "baseSampler"];

export interface ShadowBinding {
  readonly texture: BaseTexture;
  readonly matrix: Matrix;
  readonly texelSize: number;
  /** Depth bias in [0, 1] depth units. */
  readonly bias: number;
  /** 0..1, 0 disables shadow lookups. */
  readonly strength: number;
}

/**
 * Owns all toon materials (one per preset, shared between meshes) and pushes the shared
 * light rig into them. Point lights are registered by key so they can be removed again.
 */
export class ToonMaterials {
  private readonly materials = new Map<string, ShaderMaterial>();
  private readonly lights = new Map<string, PointLightDef>();
  private shadow: ShadowBinding | null = null;

  constructor(
    private readonly scene: Scene,
    private rig: LightingRig = NIGHT_RIG,
  ) {}

  get(preset: PresetName): ShaderMaterial {
    return this.cached(preset, () => this.create(preset, PRESETS[preset]));
  }

  /**
   * Toon material for an imported mesh: base colour (and optional texture) from the source
   * material, everything else from a preset. Cached so equal inputs share one material.
   */
  forImported(base: string, texture: Texture | null, preset: PresetName = "importedCharacter"): ShaderMaterial {
    const key = `imp:${preset}:${base}:${texture?.uniqueId ?? "-"}`;
    return this.cached(key, () => this.create(key, { ...PRESETS[preset], base }, texture));
  }

  setShadow(shadow: ShadowBinding | null): void {
    this.shadow = shadow;
    for (const m of this.materials.values()) this.applyShadow(m);
  }

  private flash = { x: 0, y: 0, z: 0, w: 0 };

  /** Muzzle flash light, pushed to every material while it is lit. */
  setFlash(x: number, y: number, z: number, intensity: number): void {
    if (intensity <= 0 && this.flash.w <= 0) return;
    this.flash = { x, y, z, w: Math.max(0, intensity) };
    for (const m of this.materials.values()) m.setVector4("flashLight", this.flash);
  }

  /** The light matrix moves with the player; only the matrix uniform changes. */
  setShadowMatrix(matrix: Matrix): void {
    if (!this.shadow) return;
    this.shadow = { ...this.shadow, matrix };
    for (const m of this.materials.values()) m.setMatrix("shadowMatrix", matrix);
  }

  get materialCount(): number {
    return this.materials.size;
  }

  private cached(key: string, make: () => ShaderMaterial): ShaderMaterial {
    let m = this.materials.get(key);
    if (!m) {
      m = make();
      this.materials.set(key, m);
      this.applyRig(m);
      this.applyLights(m);
      this.applyShadow(m);
      m.setVector4("flashLight", this.flash);
    }
    return m;
  }

  addLight(key: string, light: PointLightDef): void {
    if (this.lights.size >= MAX_POINT_LIGHTS && !this.lights.has(key)) return;
    this.lights.set(key, light);
    for (const m of this.materials.values()) this.applyLights(m);
  }

  removeLight(key: string): void {
    if (!this.lights.delete(key)) return;
    for (const m of this.materials.values()) this.applyLights(m);
  }

  get lightCount(): number {
    return this.lights.size;
  }

  setRig(rig: LightingRig): void {
    this.rig = rig;
    for (const m of this.materials.values()) this.applyRig(m);
  }

  private create(name: string, p: ToonPreset, texture: Texture | null = null): ShaderMaterial {
    const m = new ShaderMaterial(
      `toon-${name}`,
      this.scene,
      { vertexSource: TOON_VERTEX, fragmentSource: TOON_FRAGMENT },
      {
        attributes: texture ? ["position", "normal", "uv"] : ["position", "normal"],
        uniforms: [...UNIFORMS],
        samplers: [...SAMPLERS],
        defines: texture ? ["UV1", "TEXTURE"] : [],
      },
    );
    if (texture) m.setTexture("baseSampler", texture);
    m.setColor3("baseColor", hex(p.base));
    m.setColor3("emissiveColor", hex(p.emissive ?? "#000000"));
    m.setColor3("rimColor", hex(p.rim ?? "#ffffff"));
    m.setFloat("rimStrength", p.rimStrength ?? 0.2);
    m.setFloat("gloss", p.gloss ?? 0);
    m.setFloat("windows", p.windows ? 1 : 0);
    m.setFloat("fill", p.fill ?? 0);
    return m;
  }

  private applyRig(m: ShaderMaterial): void {
    const r = this.rig;
    m.setVector3("sunDir", { x: r.sunDir.x, y: r.sunDir.y, z: r.sunDir.z });
    m.setColor3("sunColor", hex(r.sunColor));
    m.setColor3("ambientColor", hex(r.ambient));
    m.setColor3("fogColor", hex(r.fogColor));
    m.setColor3("shadeColor", hex(r.shadeTint));
    m.setColor3("fillColor", hex(r.fillColor));
    m.setFloat("fogDensity", r.fogDensity);
  }

  private applyShadow(m: ShaderMaterial): void {
    const s = this.shadow;
    if (!s) {
      m.setMatrix("shadowMatrix", Matrix.Identity());
      m.setVector3("shadowParams", { x: 0, y: 0, z: 0 });
      return;
    }
    m.setTexture("shadowSampler", s.texture);
    m.setMatrix("shadowMatrix", s.matrix);
    m.setVector3("shadowParams", { x: s.bias, y: s.texelSize, z: s.strength });
  }

  private applyLights(m: ShaderMaterial): void {
    const pos: number[] = [];
    const col: number[] = [];
    for (const l of this.lights.values()) {
      const c = hex(l.color);
      pos.push(l.position.x, l.position.y, l.position.z, l.range);
      col.push(c.r, c.g, c.b, l.intensity);
    }
    // Uniform arrays must be fully sized.
    while (pos.length < MAX_POINT_LIGHTS * 4) {
      pos.push(0, -1000, 0, 1);
      col.push(0, 0, 0, 0);
    }
    m.setArray4("pointPos", pos);
    m.setArray4("pointColor", col);
    m.setFloat("pointCount", this.lights.size);
  }
}

export const presetHasOutline = (preset: PresetName): boolean => {
  const p = PRESETS[preset];
  return "outline" in p && p.outline;
};
