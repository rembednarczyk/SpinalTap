import { Color3, type Scene, ShaderMaterial } from "../../babylon";
import type { LightingRig } from "../../npr/lighting";

const VERTEX = /* glsl */ `
precision highp float;
attribute vec3 position;
attribute vec2 uv;
uniform mat4 viewProjection;
varying vec3 vWorld;
void main(void) {
  vWorld = position;
  gl_Position = viewProjection * vec4(position, 1.0);
}
`;

/**
 * River and pools of the map city (ADR-0044): near-black water in cel steps, slow ripple bands
 * drifting downstream, the haze of the sky at grazing angles and broken streaks of the city's
 * neon (pink and cyan) where the ripples catch it; distance fog like the toon materials.
 */
const FRAGMENT = /* glsl */ `
precision highp float;
varying vec3 vWorld;
uniform vec3 cameraPosition;
uniform vec3 deep;
uniform vec3 sky;
uniform vec3 fogColor;
uniform float fogDensity;
uniform float time;
uniform float night;
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
}
void main(void) {
  vec2 p = vWorld.xz;
  vec3 v = normalize(cameraPosition - vWorld);
  float graze = pow(1.0 - max(v.y, 0.0), 3.0);
  float r1 = noise(p * vec2(0.35, 0.9) + vec2(time * 0.25, time * 0.08));
  float r2 = noise(p * vec2(1.1, 0.4) - vec2(time * 0.12, time * 0.3));
  float ripple = step(0.62, r1 * 0.6 + r2 * 0.4);
  vec3 col = deep * (0.85 + 0.3 * step(0.5, noise(p * 0.08 + time * 0.02)));
  col = mix(col, sky, 0.35 * graze + 0.2 * ripple * graze);
  float streak = ripple * step(0.55, noise(vec2(p.x * 0.15, time * 0.05)));
  vec3 neon = mix(vec3(1.0, 0.25, 0.65), vec3(0.2, 0.85, 1.0), step(0.5, noise(p * 0.05)));
  col += neon * streak * 0.35 * night;
  float dist = length(cameraPosition - vWorld);
  float fog = 1.0 - exp(-pow(dist * fogDensity, 2.0));
  gl_FragColor = vec4(mix(col, fogColor, clamp(fog, 0.0, 1.0)), 1.0);
}
`;

export class MapWaterMaterial {
  readonly material: ShaderMaterial;
  private time = 0;

  constructor(scene: Scene) {
    const m = new ShaderMaterial("map-water", scene, { vertexSource: VERTEX, fragmentSource: FRAGMENT }, {
      attributes: ["position", "uv"],
      uniforms: ["viewProjection", "cameraPosition", "deep", "sky", "fogColor", "fogDensity", "time", "night"],
    });
    m.setFloat("time", 0);
    this.material = m;
  }

  setLook(rig: LightingRig, daylight: number): void {
    const t = Math.max(0, Math.min(1, daylight));
    const m = this.material;
    m.setColor3("deep", Color3.FromHexString(t > 0.5 ? "#2a3a44" : "#08131b"));
    m.setColor3("sky", Color3.FromHexString(rig.fogColor).scale(1.6));
    m.setColor3("fogColor", Color3.FromHexString(rig.fogColor));
    m.setFloat("fogDensity", rig.fogDensity);
    m.setFloat("night", 1 - t);
  }

  update(dt: number): void {
    this.time += dt;
    this.material.setFloat("time", this.time);
  }
}
