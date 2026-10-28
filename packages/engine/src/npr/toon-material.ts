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
  "rimTint",
  "gloss",
  "windows",
  "fogColor",
  "fogDensity",
  "pointPos",
  "pointColor",
  "pointCount",
  "selfLit",
];

const hex = (h: string): Color3 => Color3.FromHexString(h);

/**
 * Lights farther than this from the camera only get a shader slot when nearer ones leave one
 * free. Wide enough that within one district the selection is the plain registration order.
 */
export const LIGHT_SLOT_DISTANCE = 50;

const SAMPLERS = ["shadowSampler", "baseSampler"];

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
  private readonly lights = new Map<string, PointLightDef>();
  /** Lights bound to the shader's point slots, in slot order. */
  private active: PointLightDef[] = [];
  private focus: { x: number; z: number } | null = null;
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
  forImported(base: string, texture: Texture | null, preset: PresetName = "importedCharacter", options: ImportedMaterialOptions = {}): ShaderMaterial {
    const blend = options.alphaBlend === true && texture !== null;
    const cut = !blend && options.alphaTest === true && texture !== null;
    const tint = options.tint === true && texture !== null;
    const key = `imp:${preset}:${base}:${texture?.uniqueId ?? "-"}${cut ? ":cut" : ""}${blend ? ":blend" : ""}${options.doubleSided ? ":2s" : ""}${options.layer ? `:L${options.layer}` : ""}${tint ? ":tint" : ""}`;
    return this.cached(key, () => {
      const m = this.create(key, { ...PRESETS[preset], base }, texture, cut ? "ALPHATEST" : blend ? "ALPHABLEND" : null, tint);
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
      const m = this.create("cityKit", PRESETS.cityKit, palette as Texture, null, false, ["CITYKIT"]);
      m.setFloat("selfLit", 1);
      return m;
    });
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
    this.lights.set(key, light);
    this.refreshLights();
  }

  removeLight(key: string): void {
    if (!this.lights.delete(key)) return;
    this.refreshLights();
  }

  /** Moves the point slot selection to a new viewpoint. Cheap when nothing changes. */
  setLightFocus(x: number, z: number): void {
    this.focus = { x, z };
    this.refreshLights();
  }

  /** Lights currently bound to shader slots. */
  get lightCount(): number {
    return this.active.length;
  }

  private refreshLights(): void {
    const near: PointLightDef[] = [];
    const far: PointLightDef[] = [];
    const f = this.focus;
    for (const l of this.lights.values()) {
      (f === null || Math.hypot(l.position.x - f.x, l.position.z - f.z) <= LIGHT_SLOT_DISTANCE ? near : far).push(l);
    }
    const next = [...near, ...far].slice(0, MAX_POINT_LIGHTS);
    if (next.length === this.active.length && next.every((l, i) => l === this.active[i])) return;
    this.active = next;
    for (const m of this.materials.values()) this.applyLights(m);
  }

  setRig(rig: LightingRig): void {
    this.rig = rig;
    for (const m of this.materials.values()) this.applyRig(m);
  }

  private create(name: string, p: ToonPreset, texture: Texture | null = null, alpha: "ALPHATEST" | "ALPHABLEND" | null = null, tint = false, extra: readonly string[] = []): ShaderMaterial {
    const m = new ShaderMaterial(
      `toon-${name}`,
      this.scene,
      { vertexSource: TOON_VERTEX, fragmentSource: TOON_FRAGMENT },
      {
        attributes: texture ? ["position", "normal", "uv"] : ["position", "normal"],
        uniforms: [...UNIFORMS],
        samplers: [...SAMPLERS],
        defines: [
          ...(texture ? ["UV1", "TEXTURE", ...(alpha ? [alpha] : []), ...(tint ? ["TINT"] : [])] : []),
          ...(p.surface === "concrete" ? ["CONCRETE_PANELS"] : p.surface === "metal" ? ["METAL_PANELS"] : []),
          ...(p.vertexFlags ? ["DRESS_FLAGS"] : []),
          ...extra,
        ],
        needAlphaBlending: alpha === "ALPHABLEND",
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
    m.setFloat("selfLit", 1);
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
    for (const l of this.active) {
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
    m.setFloat("pointCount", this.active.length);
  }
}

export const presetHasOutline = (preset: PresetName): boolean => {
  const p = PRESETS[preset];
  return "outline" in p && p.outline;
};
