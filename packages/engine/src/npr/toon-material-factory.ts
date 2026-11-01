import { type BaseTexture, Color3, type Scene, ShaderMaterial, type Texture } from "../babylon";
import type { ToonPreset } from "./presets";
import { TOON_FRAGMENT, TOON_VERTEX } from "./toon-shader";

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
  "envStrength",
];

const SAMPLERS = ["shadowSampler", "baseSampler"];

export const hex = (h: string): Color3 => Color3.FromHexString(h);

/** The wet-asphalt probe (ADR-0036) a material compiles in: texture and brightness. */
export interface ToonEnvBinding {
  readonly texture: BaseTexture;
  readonly strength: number;
}

/** How a toon material is compiled: everything that picks defines, samplers and attributes. */
export interface ToonMaterialSpec {
  readonly texture?: Texture | null;
  readonly alpha?: "ALPHATEST" | "ALPHABLEND" | null;
  readonly tint?: boolean;
  readonly extra?: readonly string[];
  /** The probe, when this preset samples it. */
  readonly env?: ToonEnvBinding | null;
}

/**
 * Compiles one toon shader material from a preset: the defines of its surface, texture and
 * probe, and the preset's own colours. The shared light rig, lights and shadow come later.
 */
export const createToonMaterial = (scene: Scene, name: string, p: ToonPreset, spec: ToonMaterialSpec = {}): ShaderMaterial => {
  const { texture = null, alpha = null, tint = false, extra = [], env = null } = spec;
  const m = new ShaderMaterial(
    `toon-${name}`,
    scene,
    { vertexSource: TOON_VERTEX, fragmentSource: TOON_FRAGMENT },
    {
      attributes: texture ? ["position", "normal", "uv"] : p.city ? ["position", "normal", "uv", "uv2"] : ["position", "normal"],
      uniforms: [...UNIFORMS],
      samplers: env ? [...SAMPLERS, "envSampler"] : [...SAMPLERS],
      defines: [
        ...(texture ? ["UV1", "TEXTURE", ...(alpha ? [alpha] : []), ...(tint ? ["TINT"] : [])] : []),
        ...(p.surface === "concrete" ? ["CONCRETE_PANELS"] : p.surface === "metal" ? ["METAL_PANELS"] : []),
        ...(p.vertexFlags ? ["DRESS_FLAGS"] : []),
        ...(p.city === "facade" ? ["UV1", "UV2", "FACADE"] : p.city === "ground" ? ["UV1", "UV2", "MAP_GROUND"] : []),
        ...extra,
        ...(env ? ["ENV_REFLECT"] : []),
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
  if (env) {
    m.setTexture("envSampler", env.texture);
    m.setFloat("envStrength", env.strength);
  }
  return m;
};
