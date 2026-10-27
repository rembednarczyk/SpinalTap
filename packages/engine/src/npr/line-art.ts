import { type Camera, Color3, GeometryBufferRenderer, PostProcess, type Scene, ShaderStore } from "../babylon";

const LINE_ART_FRAGMENT = /* glsl */ `
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

void main(void) {
  vec4 base = texture2D(textureSampler, vUV);
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
  gl_FragColor = vec4(mix(base.rgb, inkColor * base.rgb + inkColor * 0.15, line * inkStrength), base.a);
}
`;

export interface LineArtOptions {
  /** Line weight at 720p; scaled with the render height. */
  readonly thickness?: number;
  readonly depthThreshold?: number;
  readonly normalThreshold?: number;
  readonly fadeDistance?: number;
  readonly ink?: string;
  readonly strength?: number;
}

/**
 * Screen-space ink lines for the whole scene: depth discontinuities (silhouettes) and normal
 * creases (building corners, crate edges), read from the geometry buffer. Lines fade with
 * distance so the far city reads as painted background, like an anime layout.
 */
export class LineArt {
  readonly postProcess: PostProcess;
  private readonly gbuffer: GeometryBufferRenderer;
  enabled = true;

  constructor(scene: Scene, camera: Camera, options: LineArtOptions = {}) {
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
    this.postProcess = new PostProcess(
      "line-art",
      "seekiLineArt",
      ["texel", "lineParams", "inkColor", "inkStrength"],
      ["depthSampler", "normalSampler"],
      1,
      camera,
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
    };
  }

  /** Keeps a mesh out of the line pass (glow sprites, rain, VFX). */
  exclude(meshes: { isPickable: boolean }[]): void {
    void meshes;
  }

  get geometryBuffer(): GeometryBufferRenderer {
    return this.gbuffer;
  }
}
