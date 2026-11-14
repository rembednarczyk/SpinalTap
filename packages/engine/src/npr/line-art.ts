import { type Camera, Color3, GeometryBufferRenderer, PostProcess, type Scene, ShaderStore } from "../babylon";
import { CONTACT_SHADE_TINT, type ContactShade } from "./contact-shade";
import { ContactShadePass } from "./contact-shade-pass";

/**
 * Joint bilateral upsampling of the half-resolution shade: four neighbours weighed by how close
 * their depth is to this pixel's, so the shade's edge follows the silhouettes at full resolution.
 */
const UPSAMPLE_GLSL = /* glsl */ `
uniform sampler2D colorSampler;
float upsampledShade(float d) {
  float sum = 0.0;
  float wsum = 1e-4;
  for (int i = 0; i < 4; i++) {
    vec2 o = vec2(i == 0 || i == 2 ? -1.0 : 1.0, i < 2 ? -1.0 : 1.0) * texel;
    float w = exp(-abs(depthAt(vUV + o) - d) / (0.02 * d + 1e-3));
    sum += texture2D(textureSampler, vUV + o).r * w;
    wsum += w;
  }
  return sum / wsum;
}
`;

/**
 * With `SHADED` defined, the input is the blurred contact shade and the scene's colour comes from
 * `colorSampler`; without it the input is the scene. A define, not two shaders, so the player's
 * contact-shade setting switches the pass at once (graphics toggles 14.11).
 */
export const LINE_ART_FRAGMENT = /* glsl */ `
precision highp float;
varying vec2 vUV;
uniform sampler2D textureSampler;
uniform sampler2D depthSampler;
uniform sampler2D normalSampler;
uniform vec2 texel;
/** x: thickness in pixels, y: relative depth threshold, z: normal threshold, w: fade-out distance (m). */
uniform vec4 lineParams;
uniform vec3 inkColor;
uniform float inkStrength;

float depthAt(vec2 uv) { return texture2D(depthSampler, uv).r; }
vec3 normalAt(vec2 uv) { return normalize(texture2D(normalSampler, uv).xyz + 1e-5); }
uniform vec3 shadeTint;
/** x: unused, y: strength (0 off), z: step threshold. */
uniform vec4 shadeParams;
#ifdef SHADED
${UPSAMPLE_GLSL}
#endif

void main(void) {
#ifdef SHADED
  vec4 base = texture2D(colorSampler, vUV);
#else
  vec4 base = texture2D(textureSampler, vUV);
#endif
  float d = depthAt(vUV);
  if (d <= 0.0) { gl_FragColor = base; return; }
  vec2 o = texel * lineParams.x;
  vec2 offs[4];
  offs[0] = vec2(o.x, 0.0);
  offs[1] = vec2(-o.x, 0.0);
  offs[2] = vec2(0.0, o.y);
  offs[3] = vec2(0.0, -o.y);
  vec3 n = normalAt(vUV);
  float dEdge = 0.0;
  float nEdge = 0.0;
  for (int i = 0; i < 4; i++) {
    float dn = depthAt(vUV + offs[i]);
    // Only the nearer side draws the line, so silhouettes stay one pixel wide.
    float gap = dn <= 0.0 ? 1.0 : max(0.0, dn - d) / d;
    dEdge = max(dEdge, gap);
    nEdge = max(nEdge, 1.0 - dot(n, normalAt(vUV + offs[i])));
  }
  float line = max(smoothstep(lineParams.y, lineParams.y * 2.0, dEdge), smoothstep(lineParams.z, lineParams.z * 1.6, nEdge));
  line *= 1.0 - smoothstep(lineParams.w * 0.55, lineParams.w, d);
#ifdef SHADED
  float occ = upsampledShade(d);
#else
  float occ = 0.0;
#endif
  // One hard step, as a painted shadow shape; the blur before this keeps its edge clean.
  float shade = shadeParams.y * smoothstep(shadeParams.z - 0.03, shadeParams.z + 0.03, occ);
  vec3 shaded = mix(base.rgb, base.rgb * shadeTint, shade);
  gl_FragColor = vec4(mix(shaded, inkColor * shaded + inkColor * 0.15, line * inkStrength), base.a);
}
`;

/** The line art's defines with or without the contact shade. */
export const shadeDefines = (on: boolean): string => (on ? "#define SHADED" : "");

export interface LineArtOptions {
  /** Line weight at 720p; scaled with the render height. */
  readonly thickness?: number;
  readonly depthThreshold?: number;
  readonly normalThreshold?: number;
  readonly fadeDistance?: number;
  readonly ink?: string;
  readonly strength?: number;
  /** Contact shade in the same pass (graphics backlog 13.11, step 2); off when absent. */
  readonly contactShade?: ContactShade | null;
}

/**
 * Screen-space ink lines for the whole scene: depth discontinuities (silhouettes) and normal
 * creases (building corners, crate edges), read from the geometry buffer. Lines fade with
 * distance so the far city reads as painted background, like an anime layout.
 */
export class LineArt {
  readonly postProcess: PostProcess;
  private readonly gbuffer: GeometryBufferRenderer;
  /** The contact-shade passes in front, when the quality builds them. */
  private readonly shadePass: ContactShadePass | null;
  /** The player's contact-shade setting (graphics toggles 14.11): the passes are on the camera. */
  private shadeOn: boolean;
  enabled = true;

  constructor(
    scene: Scene,
    private readonly camera: Camera,
    options: LineArtOptions = {},
  ) {
    const shade = options.contactShade ?? null;
    ShaderStore.ShadersStore["seekiLineArtFragmentShader"] = LINE_ART_FRAGMENT;
    const gbuffer = scene.enableGeometryBufferRenderer();
    if (!gbuffer) throw new Error("Geometry buffer unavailable");
    gbuffer.enableNormal = true;
    gbuffer.enableDepth = true;
    this.gbuffer = gbuffer;
    const ink = Color3.FromHexString(options.ink ?? "#0b1016");
    const thickness = options.thickness ?? 1;
    const params = [thickness, options.depthThreshold ?? 0.035, options.normalThreshold ?? 0.35, options.fadeDistance ?? 70] as const;
    const strength = options.strength ?? 0.92;
    const engine = scene.getEngine();
    // In front of the line art on the camera, so it is built first.
    const shadePass = shade ? new ContactShadePass(scene, camera, gbuffer, shade, params[3], () => this.enabled) : null;
    this.shadePass = shadePass;
    this.shadeOn = shadePass !== null;
    this.postProcess = new PostProcess(
      "line-art",
      "seekiLineArt",
      ["texel", "lineParams", "inkColor", "inkStrength", "shadeParams", "shadeTint"],
      shade ? ["depthSampler", "normalSampler", "colorSampler"] : ["depthSampler", "normalSampler"],
      1,
      camera,
      undefined,
      undefined,
      undefined,
      shadeDefines(this.shadeOn),
    );
    this.postProcess.onApply = (effect) => {
      const w = engine.getRenderWidth();
      const h = engine.getRenderHeight();
      const g = gbuffer.getGBuffer();
      effect.setTexture("depthSampler", g.textures[gbuffer.getTextureIndex(GeometryBufferRenderer.DEPTH_TEXTURE_TYPE)] ?? null);
      effect.setTexture("normalSampler", g.textures[gbuffer.getTextureIndex(GeometryBufferRenderer.NORMAL_TEXTURE_TYPE)] ?? null);
      effect.setFloat2("texel", 1 / w, 1 / h);
      effect.setFloat4("lineParams", Math.max(1, (params[0] * h) / 720), params[1], params[2], params[3]);
      effect.setColor3("inkColor", ink);
      effect.setFloat("inkStrength", this.enabled ? strength : 0);
      if (shadePass && this.shadeOn) effect.setTextureFromPostProcess("colorSampler", shadePass.colourSource);
      effect.setFloat4("shadeParams", 0, this.enabled && shade && this.shadeOn ? shade.strength : 0, shade?.threshold ?? 1, 0);
      effect.setFloat3("shadeTint", ...CONTACT_SHADE_TINT);
    };
  }

  /** The quality builds the contact shade, so the player's setting can switch it. */
  get hasContactShade(): boolean {
    return this.shadePass !== null;
  }

  get contactShade(): boolean {
    return this.shadeOn;
  }

  /**
   * The player's contact-shade setting, at once (graphics toggles 14.11): off takes both passes
   * off the camera, so they cost nothing, and the line art reads the scene again. The scene's
   * multisampling moves with the first pass. Without the passes (Low, Medium) nothing changes.
   */
  setContactShade(on: boolean): void {
    const pass = this.shadePass;
    if (!pass || on === this.shadeOn) return;
    this.shadeOn = on;
    if (on) {
      pass.attach(this.camera, this.postProcess);
      pass.colourSource.samples = this.postProcess.samples;
      this.postProcess.samples = 1;
    } else {
      this.postProcess.samples = pass.colourSource.samples;
      pass.colourSource.samples = 1;
      pass.detach(this.camera);
    }
    this.postProcess.updateEffect(shadeDefines(on));
  }

  /** Keeps a mesh out of the line pass (glow sprites, rain, VFX). */
  exclude(meshes: { isPickable: boolean }[]): void {
    void meshes;
  }

  get geometryBuffer(): GeometryBufferRenderer {
    return this.gbuffer;
  }
}
