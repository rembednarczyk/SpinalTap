import { type BaseTexture, BindBonesParameters, Color3, type Scene, ShaderMaterial, type Texture } from "../babylon";
import type { ToonPreset } from "./presets";
import { ditherOf } from "./body-dither";
import type { DetailBinding } from "./detail-textures";
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
  "pointClip",
  "pointClipY",
  "pointCount",
  "selfLit",
  "envStrength",
  "dither",
  "wetTint",
  "streakLamp",
  "streakColor",
  "streakCount",
];

const SAMPLERS = ["shadowSampler", "shadowMovingSampler", "baseSampler"];

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
  /** The detail textures (ADR-0092), for the city's facades and ground. */
  readonly detail?: DetailBinding | null;
}

/**
 * Compiles one toon shader material from a preset: the defines of its surface, texture and
 * probe, and the preset's own colours. The shared light rig, lights and shadow come later.
 */
export const createToonMaterial = (scene: Scene, name: string, p: ToonPreset, spec: ToonMaterialSpec = {}): ShaderMaterial => {
  const { texture = null, alpha = null, tint = false, extra = [], env = null, detail = null } = spec;
  const m = new ShaderMaterial(
    `toon-${name}`,
    scene,
    { vertexSource: TOON_VERTEX, fragmentSource: TOON_FRAGMENT },
    {
      attributes: texture ? ["position", "normal", "uv"] : p.city ? ["position", "normal", "uv", "uv2", ...(p.water ? ["uv3"] : [])] : ["position", "normal"],
      uniforms: [...UNIFORMS],
      samplers: [...SAMPLERS, ...(env ? ["envSampler"] : []), ...(detail ? detail.map(([name]) => name) : [])],
      defines: [
        ...(texture ? ["UV1", "TEXTURE", ...(alpha ? [alpha] : []), ...(tint ? ["TINT"] : [])] : []),
        ...(p.surface === "concrete" ? ["CONCRETE_PANELS"] : p.surface === "metal" ? ["METAL_PANELS"] : []),
        ...(p.vertexFlags ? ["DRESS_FLAGS"] : []),
        ...(p.city === "facade" ? ["UV1", "UV2", "FACADE"] : p.city === "ground" ? ["UV1", "UV2", "MAP_GROUND"] : []),
        ...(p.water ? ["WATER_MASK"] : []),
        ...extra,
        ...(env ? ["ENV_REFLECT"] : []),
        ...(detail ? ["DETAIL"] : []),
      ],
      needAlphaBlending: alpha === "ALPHABLEND",
    },
  );
  // Per mesh, after the shared uniforms: only the player's figure is ever faded. The bones too:
  // ShaderMaterial binds them only when the material or effect changes (`mustRebind`), so the cut
  // garments and cloth of several characters, drawn one after another in the alpha-test list with
  // one material, took the first one's skeleton: a jacket on kaito.vrm's 117 bones read the
  // ganger's 67 and threw spikes across to the others, and a ganger's jacket and the skin left
  // under it took another's pose, a second figure beside its own (user notes of 25.11, G-974).
  m.onBindObservable.add((mesh) => {
    const effect = m.getEffect();
    if (!effect) return;
    effect.setFloat("dither", ditherOf(mesh));
    if (mesh.skeleton && mesh.useBones && mesh.computeBonesUsingShaders) BindBonesParameters(mesh, effect);
  });
  if (texture) m.setTexture("baseSampler", texture);
  m.setColor3("baseColor", hex(p.base));
  m.setColor3("emissiveColor", hex(p.emissive ?? "#000000"));
  m.setColor3("rimColor", hex(p.rim ?? "#ffffff"));
  m.setFloat("rimStrength", p.rimStrength ?? 0.2);
  m.setFloat("gloss", p.gloss ?? 0);
  m.setFloat("windows", p.windows ? 1 : 0);
  m.setFloat("fill", p.fill ?? 0);
  m.setFloat("selfLit", 1);
  for (const [name, tex] of detail ?? []) m.setTexture(name, tex);
  if (env) {
    m.setTexture("envSampler", env.texture);
    m.setFloat("envStrength", env.strength);
  }
  return m;
};
