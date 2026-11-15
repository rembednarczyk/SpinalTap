import { Constants, type Scene, ShaderMaterial } from "../../babylon";

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
  } else {
    p += vec3(uv.x, 0.0, uv.y) * size;
  }
  vUV = uv;
  vColor = color.rgb;
  gl_Position = viewProjection * vec4(p, 1.0);
}
`;

const FRAGMENT = /* glsl */ `
precision highp float;
varying vec2 vUV;
varying vec3 vColor;
varying float vKind;
varying float vDist;
uniform float intensity;
uniform float fogDensity;
void main(void) {
  float r = length(vUV);
  float k = max(1.0 - r, 0.0);
  float a = vKind < 0.5 ? pow(k, 2.2) * 0.85 + pow(k, 9.0) * 0.7 : pow(k, 1.5) * 0.38;
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
