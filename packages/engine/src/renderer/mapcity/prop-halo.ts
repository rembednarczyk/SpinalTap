import { Constants, type Scene, ShaderMaterial } from "../../babylon";
import { STREET_FIELD_GLSL, WATER_GLSL } from "../../npr/water-mask";

const VERTEX = /* glsl */ `
precision highp float;
attribute vec3 position;
attribute vec4 color;
attribute vec2 uv;
attribute vec2 uv2;
uniform mat4 view;
uniform mat4 viewProjection;
uniform vec3 cameraPosition;
varying vec2 vUV;
varying vec3 vColor;
varying float vKind;
varying float vDist;
varying vec2 vWorld;
void main(void) {
  float size = uv2.x;
  vKind = uv2.y;
  vec3 p = position;
  vec3 toEye = cameraPosition - position;
  vDist = length(toEye);
  if (vKind < 0.5) {
    vec3 right = vec3(view[0][0], view[1][0], view[2][0]);
    vec3 up = vec3(view[0][1], view[1][1], view[2][1]);
    // Pulled a little towards the eye, so the lamp's own glass does not swallow its glow.
    p += (right * uv.x + up * uv.y) * size + normalize(toEye) * min(size * 0.5, vDist * 0.2);
    vUV = uv;
  } else {
    // The pool reaches on towards the eye: its light's streak on the wet street (ADR-0084), in
    // the pool's sizes from 1 behind the lamp to 2.4 in front of it.
    vec2 f = toEye.xz;
    float lf = length(f);
    f = lf > 0.01 ? f / lf : vec2(0.0, 1.0);
    float along = mix(-1.0, 2.4, uv.y * 0.5 + 0.5);
    p.xz += (vec2(-f.y, f.x) * uv.x + f * along) * size;
    vUV = vec2(uv.x, along);
  }
  vColor = color.rgb;
  vWorld = p.xz;
  gl_Position = viewProjection * vec4(p, 1.0);
}
`;

const FRAGMENT = /* glsl */ `
precision highp float;
varying vec2 vUV;
varying vec3 vColor;
varying float vKind;
varying float vDist;
varying vec2 vWorld;
uniform float intensity;
uniform float fogDensity;
${WATER_GLSL}
void main(void) {
  float r = length(vUV);
  float k = max(1.0 - r, 0.0);
  float a = pow(k, 2.2) * 0.85 + pow(k, 9.0) * 0.7;
  if (vKind > 0.5) {
    // The soft pool, and the streak drawn out of it in two flat steps, brighter in standing water.
    float streak = max(1.0 - length(vec2(vUV.x * 4.5, (vUV.y - 0.8) / 1.5)), 0.0);
    float stand = waterStanding(${STREET_FIELD_GLSL}, vWorld);
    a = pow(k, 1.5) * 0.38 + (step(0.2, streak) + step(0.55, streak)) * mix(0.05, 0.08, stand);
  }
  a *= intensity * exp(-fogDensity * vDist * 0.6);
  gl_FragColor = vec4(vColor * a, a);
}
`;

/**
 * The street lamps' halos (ADR-0047): camera-facing additive sprites at every light and soft
 * pools on the pavement under them, one mesh per cell, no dynamic lights. They fade out by day
 * and into the fog, outside the G-buffer (no ink), the shadow and the glow layer.
 */
export class PropHaloMaterial {
  readonly material: ShaderMaterial;

  constructor(scene: Scene) {
    const m = new ShaderMaterial("street-prop-halos", scene, { vertexSource: VERTEX, fragmentSource: FRAGMENT }, {
      attributes: ["position", "color", "uv", "uv2"],
      uniforms: ["view", "viewProjection", "cameraPosition", "intensity", "fogDensity"],
      needAlphaBlending: true,
    });
    m.alphaMode = Constants.ALPHA_ONEONE;
    m.disableDepthWrite = true;
    m.backFaceCulling = false;
    m.setFloat("intensity", 1);
    m.setFloat("fogDensity", 0.02);
    this.material = m;
  }

  /** Night 0 .. day 1: full glow at night, none by day. */
  setLook(daylight: number, fogDensity: number): void {
    const night = 1 - Math.max(0, Math.min(1, daylight));
    this.material.setFloat("intensity", night * night);
    this.material.setFloat("fogDensity", fogDensity);
  }
}
