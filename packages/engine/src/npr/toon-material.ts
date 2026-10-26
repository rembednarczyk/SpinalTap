import { Color3, type Scene, ShaderMaterial } from "../babylon";
import { NIGHT_RIG, type LightingRig, type PointLightDef } from "./lighting";
import { PRESETS, type PresetName } from "./presets";
import { MAX_POINT_LIGHTS, TOON_FRAGMENT, TOON_VERTEX } from "./toon-shader";

const UNIFORMS = [
  "world",
  "worldViewProjection",
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

/**
 * Owns all toon materials (one per preset, shared between meshes) and pushes the shared
 * light rig into them. Point lights are registered by key so they can be removed again.
 */
export class ToonMaterials {
  private readonly materials = new Map<PresetName, ShaderMaterial>();
  private readonly lights = new Map<string, PointLightDef>();

  constructor(
    private readonly scene: Scene,
    private rig: LightingRig = NIGHT_RIG,
  ) {}

  get(preset: PresetName): ShaderMaterial {
    let m = this.materials.get(preset);
    if (!m) {
      m = this.create(preset);
      this.materials.set(preset, m);
      this.applyRig(m);
      this.applyLights(m);
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

  private create(preset: PresetName): ShaderMaterial {
    const p = PRESETS[preset];
    const m = new ShaderMaterial(
      `toon-${preset}`,
      this.scene,
      { vertexSource: TOON_VERTEX, fragmentSource: TOON_FRAGMENT },
      { attributes: ["position", "normal"], uniforms: UNIFORMS },
    );
    m.setColor3("baseColor", hex(p.base));
    m.setColor3("emissiveColor", hex("emissive" in p ? p.emissive : "#000000"));
    m.setColor3("rimColor", hex("rim" in p ? p.rim : "#ffffff"));
    m.setFloat("rimStrength", "rimStrength" in p ? p.rimStrength : 0.2);
    m.setFloat("gloss", "gloss" in p ? p.gloss : 0);
    m.setFloat("windows", "windows" in p && p.windows ? 1 : 0);
    return m;
  }

  private applyRig(m: ShaderMaterial): void {
    const r = this.rig;
    m.setVector3("sunDir", { x: r.sunDir.x, y: r.sunDir.y, z: r.sunDir.z });
    m.setColor3("sunColor", hex(r.sunColor));
    m.setColor3("ambientColor", hex(r.ambient));
    m.setColor3("fogColor", hex(r.fogColor));
    m.setFloat("fogDensity", r.fogDensity);
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
