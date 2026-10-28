import { type Camera, PostProcess, type Scene, ShaderStore } from "../babylon";

const SPEED_LINES_FRAGMENT = /* glsl */ `
precision highp float;
varying vec2 vUV;
uniform sampler2D textureSampler;
uniform float intensity;
uniform float time;
uniform float aspect;

float hash(float x) { return fract(sin(x * 91.3) * 43758.5453); }

void main(void) {
  vec4 c = texture2D(textureSampler, vUV);
  if (intensity <= 0.0) { gl_FragColor = c; return; }
  vec2 p = (vUV - 0.5) * vec2(aspect, 1.0);
  float r = length(p);
  float a = atan(p.y, p.x);
  // Radial ink streaks, re-drawn a few times per second like hand-animated speed lines.
  float slot = floor(a * 48.0);
  float frame = floor(time * 10.0);
  float on = step(0.86, hash(slot + frame * 13.7));
  float width = smoothstep(0.32, 0.5, 0.5 - abs(fract(a * 48.0) - 0.5));
  float reach = 0.46 + 0.2 * hash(slot * 3.1 + frame);
  float mask = on * width * smoothstep(reach, reach + 0.2, r) * intensity;
  c.rgb = mix(c.rgb, vec3(0.9, 0.96, 1.0), mask * 0.28);
  gl_FragColor = c;
}
`;

/** Anime speed lines at the screen edge, while the reflex overdrive runs and in a burst on a dash. */
export class SpeedLines {
  readonly postProcess: PostProcess;
  intensity = 0;
  private target = 0;
  private time = 0;

  constructor(scene: Scene, camera: Camera) {
    ShaderStore.ShadersStore["seekiSpeedLinesFragmentShader"] = SPEED_LINES_FRAGMENT;
    const engine = scene.getEngine();
    this.postProcess = new PostProcess("speed-lines", "seekiSpeedLines", ["intensity", "time", "aspect"], [], 1, camera);
    this.postProcess.onApply = (effect) => {
      effect.setFloat("intensity", this.intensity);
      effect.setFloat("time", this.time);
      effect.setFloat("aspect", engine.getRenderWidth() / Math.max(1, engine.getRenderHeight()));
    };
  }

  /** A short burst over whatever runs (ADR-0036): decays over about a third of a second. */
  private burst = 0;

  set active(on: boolean) {
    this.target = on ? 1 : 0;
  }

  /** A dash: the lines snap in at `amount` and fade out by themselves. */
  pulse(amount: number): void {
    this.burst = Math.max(this.burst, Math.min(1, amount));
  }

  update(dt: number): void {
    this.time += dt;
    this.burst = Math.max(0, this.burst - dt / 0.35);
    const target = Math.max(this.target, this.burst);
    this.intensity = this.burst > this.intensity ? this.burst : this.intensity + (target - this.intensity) * Math.min(1, dt * 5);
    if (this.intensity < 0.01 && target === 0) this.intensity = 0;
  }
}
