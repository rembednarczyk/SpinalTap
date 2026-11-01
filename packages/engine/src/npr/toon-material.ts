import { type BaseTexture, Matrix, type Scene, type ShaderMaterial, type Texture } from "../babylon";
import { NIGHT_RIG, type LightingRig, type PointLightDef } from "./lighting";
import { PRESETS, type PresetName } from "./presets";
import { ToonEnvironment } from "./toon-environment";
import { createToonMaterial, hex } from "./toon-material-factory";
import { ToonPointLights } from "./toon-point-lights";

export { LIGHT_SLOT_DISTANCE } from "./toon-point-lights";

export interface ImportedMaterialOptions {
  /** Discard texels with alpha below 0.5 (glTF MASK and BLEND materials). */
  readonly alphaTest?: boolean;
  /** Real alpha blending (glTF BLEND), for thin layers over an opaque surface. Wins over alphaTest. */
  readonly alphaBlend?: boolean;
  readonly doubleSided?: boolean;
  /** Stacking order of coplanar face layers (eye white < iris < highlight); 0 for the rest. */
  readonly layer?: number;
  /**
   * Garment colour (ADR-0015 E7): the texture only gives the brightness and `base` the hue,
   * so a dark or patterned cloth reads as the tint too. Needs a texture.
   */
  readonly tint?: boolean;
}

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
  private readonly lights = new ToonPointLights();
  private shadow: ShadowBinding | null = null;
  private readonly env = new ToonEnvironment();

  constructor(
    private readonly scene: Scene,
    private rig: LightingRig = NIGHT_RIG,
  ) {}

  /** The light rig pushed into every material now (fog and colours of the look on screen). */
  get currentRig(): LightingRig {
    return this.rig;
  }

  get(preset: PresetName): ShaderMaterial {
    return this.cached(preset, () => createToonMaterial(this.scene, preset, PRESETS[preset], { env: this.env.bindingFor(preset) }));
  }

  /**
   * Toon material for an imported mesh: base colour (and optional texture) from the source
   * material, everything else from a preset. Cached so equal inputs share one material.
   */
  forImported(base: string, texture: Texture | null, preset: PresetName = "importedCharacter", options: ImportedMaterialOptions = {}): ShaderMaterial {
    const blend = options.alphaBlend === true && texture !== null;
    const cut = !blend && options.alphaTest === true && texture !== null;
    const tint = options.tint === true && texture !== null;
    const key = `imp:${preset}:${base}:${texture?.uniqueId ?? "-"}${cut ? ":cut" : ""}${blend ? ":blend" : ""}${options.doubleSided ? ":2s" : ""}${options.layer ? `:L${options.layer}` : ""}${tint ? ":tint" : ""}`;
    return this.cached(key, () => {
      const alpha = cut ? "ALPHATEST" : blend ? "ALPHABLEND" : null;
      const m = createToonMaterial(this.scene, key, { ...PRESETS[preset], base }, { texture, alpha, tint, env: this.env.bindingFor(key) });
      if (options.doubleSided) m.backFaceCulling = false;
      if (options.layer) {
        // Polygon offset, so the nearer layer wins the depth test whatever the draw order.
        m.zOffset = -options.layer;
        m.zOffsetUnits = -4 * options.layer;
      }
      return m;
    });
  }

  /**
   * The city kit's material (ADR-0022): colour from the swatch palette, whose alpha marks
   * tinted walls (vertex colour) and self-lit swatches (windows, neon). One per palette.
   */
  forCityKit(palette: BaseTexture): ShaderMaterial {
    return this.cached(`city:${palette.uniqueId}`, () => {
      const m = createToonMaterial(this.scene, "cityKit", PRESETS.cityKit, { texture: palette as Texture, extra: ["CITYKIT"], env: this.env.bindingFor("cityKit") });
      m.setFloat("selfLit", 1);
      return m;
    });
  }

  /**
   * The static reflection probe the wet surfaces sample (ADR-0036). Call before the first
   * material of those presets is created: the reflection is compiled in, not toggled.
   */
  setEnvironment(texture: BaseTexture, presets: ReadonlySet<string>, strength = 1.6): void {
    this.env.set(texture, presets, strength);
    for (const [name, m] of this.materials) if (presets.has(name)) m.setTexture("envSampler", texture);
  }

  /** Brightness of the probe on wet surfaces, 0 while it holds nothing yet. */
  setEnvironmentStrength(strength: number): void {
    if (!this.env.setStrength(strength)) return;
    for (const [name, m] of this.materials) if (this.env.samples(name)) m.setFloat("envStrength", strength);
  }

  /** Materials compiled with the probe (debug, tests). */
  get reflectiveCount(): number {
    return [...this.materials.keys()].filter((k) => this.env.samples(k)).length;
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
      this.lights.apply(m);
      this.applyShadow(m);
      m.setVector4("flashLight", this.flash);
      m.setVector4("rimTint", this.rimTint);
    }
    return m;
  }

  private rimTint = { x: 1, y: 1, z: 1, w: 0 };

  /** District rim colour (ADR-0030), mixed over every preset's own rim by `weight`. */
  setRimTint(color: string, weight: number): void {
    const c = hex(color);
    const next = { x: c.r, y: c.g, z: c.b, w: Math.max(0, Math.min(1, weight)) };
    const r = this.rimTint;
    if (r.x === next.x && r.y === next.y && r.z === next.z && r.w === next.w) return;
    this.rimTint = next;
    for (const m of this.materials.values()) m.setVector4("rimTint", next);
  }

  /**
   * Registers a point light. Only MAX_POINT_LIGHTS fit the shader: slots go in registration
   * order, first to lights within LIGHT_SLOT_DISTANCE of the focus (the camera), then to the
   * rest. Lights that do not fit wait and take a slot when one frees up, e.g. when the
   * district they shadowed streams out.
   */
  addLight(key: string, light: PointLightDef): void {
    if (this.lights.add(key, light)) this.pushLights();
  }

  removeLight(key: string): void {
    if (this.lights.remove(key)) this.pushLights();
  }

  /** Moves the point slot selection to a new viewpoint. Cheap when nothing changes. */
  setLightFocus(x: number, z: number): void {
    if (this.lights.setFocus(x, z)) this.pushLights();
  }

  /** Lights currently bound to shader slots. */
  get lightCount(): number {
    return this.lights.count;
  }

  private pushLights(): void {
    for (const m of this.materials.values()) this.lights.apply(m);
  }

  setRig(rig: LightingRig): void {
    this.rig = rig;
    for (const m of this.materials.values()) this.applyRig(m);
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
}

export const presetHasOutline = (preset: PresetName): boolean => {
  const p = PRESETS[preset];
  return "outline" in p && p.outline;
};
