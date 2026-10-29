import { type Camera, PostProcess, type Scene, ShaderStore } from "../babylon";
import type { FxUniforms } from "./gameplay-fx";

/**
 * One full-screen pass for every gameplay event (ADR-0030): chromatic aberration and slice
 * glitch on hits and quickhacks, the scanner (scanlines, vignette, drained colour), the red-blue
 * heat glow at the edges, red after a hit and the zoom blur of a dash. Uniforms only; nothing recompiles at runtime.
 */
const FX_FRAGMENT = /* glsl */ `
precision highp float;
varying vec2 vUV;
uniform sampler2D textureSampler;
uniform vec2 screenSize;
uniform float time;
uniform float aberration;
uniform float glitch;
uniform float scan;
uniform float heat;
uniform float heatMix;
uniform float hurt;
uniform float blur;
uniform float reduce;

float hash(float x) { return fract(sin(x * 127.1) * 43758.5453); }

void main(void) {
  vec2 uv = vUV;
  // Glitch: a few horizontal slices pushed sideways, a new pattern every few frames.
  if (glitch > 0.001) {
    float frame = floor(time * 18.0);
    float band = floor(uv.y * 22.0);
    float pick = step(1.0 - 0.45 * glitch, hash(band * 3.7 + frame * 11.3));
    uv.x += (hash(band + frame) - 0.5) * 0.08 * glitch * pick;
  }
  vec2 d = uv - 0.5;
  vec3 col;
  if (aberration > 0.001) {
    vec2 off = d * (0.018 * aberration);
    col = vec3(texture2D(textureSampler, uv + off).r, texture2D(textureSampler, uv).g, texture2D(textureSampler, uv - off).b);
  } else {
    col = texture2D(textureSampler, uv).rgb;
  }
  // Dash (ADR-0036): a zoom blur towards the middle, the centre stays sharp.
  if (blur > 0.001) {
    vec3 acc = col;
    float k = blur * 0.028 * smoothstep(0.1, 0.7, length(d) * 2.0);
    for (int i = 1; i <= 5; i++) acc += texture2D(textureSampler, uv - d * k * float(i)).rgb;
    col = acc / 6.0;
  }
  // Distance to the frame edge, 0 in the middle, 1 at the border.
  float edge = max(abs(d.x), abs(d.y)) * 2.0;
  float radial = length(d * vec2(1.0, 0.8)) * 1.6;
  // Scanner: drained, slightly cold colour, fine scanlines, a soft vignette.
  if (scan > 0.001) {
    float lum = dot(col, vec3(0.299, 0.587, 0.114));
    col = mix(col, vec3(lum) * vec3(0.86, 1.02, 1.08), 0.6 * scan);
    float row = vUV.y * screenSize.y * 0.5 - time * 6.0 * (1.0 - reduce);
    col *= 1.0 - 0.1 * scan * (0.5 + 0.5 * sin(row * 3.14159));
    col *= 1.0 - 0.38 * scan * smoothstep(0.45, 1.15, radial);
  }
  // Heat: the hunters' red and blue at the edges.
  if (heat > 0.001) {
    vec3 siren = mix(vec3(1.0, 0.1, 0.18), vec3(0.16, 0.36, 1.0), heatMix);
    col += siren * heat * 0.6 * smoothstep(0.45, 1.0, edge);
  }
  // A hit: red creeping in from the edges.
  if (hurt > 0.001) {
    float k = hurt * smoothstep(0.25, 1.0, radial);
    col = mix(col, col * vec3(1.0, 0.3, 0.3) + vec3(0.3, 0.0, 0.04), k * 0.9);
  }
  gl_FragColor = vec4(col, 1.0);
}
`;

const NAMES = ["screenSize", "time", "aberration", "glitch", "scan", "heat", "heatMix", "hurt", "blur", "reduce"];

/**
 * The pass itself. It stays off the camera while nothing is on screen, so idle frames (and the
 * NPR reference frame) cost nothing; the shader compiles at construction all the same.
 */
export class GameplayPost {
  readonly postProcess: PostProcess;
  private attached = true;
  private values: FxUniforms | null = null;

  constructor(
    scene: Scene,
    private readonly camera: Camera,
  ) {
    ShaderStore.ShadersStore["sekiGameplayFxFragmentShader"] = FX_FRAGMENT;
    const engine = scene.getEngine();
    this.postProcess = new PostProcess("gameplay-fx", "sekiGameplayFx", NAMES, null, 1, camera);
    this.postProcess.onApply = (effect) => {
      const v = this.values;
      effect.setFloat2("screenSize", engine.getRenderWidth(), engine.getRenderHeight());
      effect.setFloat("time", v?.time ?? 0);
      effect.setFloat("aberration", v?.aberration ?? 0);
      effect.setFloat("glitch", v?.glitch ?? 0);
      effect.setFloat("scan", v?.scan ?? 0);
      effect.setFloat("heat", v?.heat ?? 0);
      effect.setFloat("heatMix", v?.heatMix ?? 0);
      effect.setFloat("hurt", v?.hurt ?? 0);
      effect.setFloat("blur", v?.blur ?? 0);
      effect.setFloat("reduce", v?.reduce ?? 0);
    };
    this.setActive(false);
  }

  /** The shader is compiled (warm-up check). */
  get ready(): boolean {
    return this.postProcess.isReady();
  }

  update(values: FxUniforms, active: boolean): void {
    this.values = values;
    this.setActive(active);
  }

  private setActive(on: boolean): void {
    if (on === this.attached) return;
    this.attached = on;
    if (on) this.camera.attachPostProcess(this.postProcess);
    else this.camera.detachPostProcess(this.postProcess);
  }
}
