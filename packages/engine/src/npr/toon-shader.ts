/** Number of point lights the toon shader evaluates per fragment. */
export const MAX_POINT_LIGHTS = 8;

export const TOON_VERTEX = /* glsl */ `
precision highp float;
attribute vec3 position;
attribute vec3 normal;
uniform mat4 world;
uniform mat4 worldViewProjection;
varying vec3 vWorldPos;
varying vec3 vNormal;

void main(void) {
  vec4 wp = world * vec4(position, 1.0);
  vWorldPos = wp.xyz;
  vNormal = normalize(mat3(world) * normal);
  gl_Position = worldViewProjection * vec4(position, 1.0);
}
`;

/**
 * Cel shading: light is quantised into two hard bands, a hard-edged rim light outlines the
 * silhouette, glossy surfaces get stepped highlights from street lights (wet asphalt), and
 * building facades get procedural lit windows. Distance fog is applied last.
 */
export const TOON_FRAGMENT = /* glsl */ `
precision highp float;
varying vec3 vWorldPos;
varying vec3 vNormal;

uniform vec3 cameraPosition;
uniform vec3 baseColor;
uniform vec3 emissiveColor;
uniform vec3 sunDir;
uniform vec3 sunColor;
uniform vec3 ambientColor;
uniform vec3 rimColor;
uniform float rimStrength;
uniform float gloss;
uniform float windows;
uniform vec3 fogColor;
uniform float fogDensity;
uniform vec4 pointPos[${MAX_POINT_LIGHTS}];
uniform vec4 pointColor[${MAX_POINT_LIGHTS}];
uniform float pointCount;

float band(float x) {
  return smoothstep(0.03, 0.07, x) * 0.55 + smoothstep(0.42, 0.47, x) * 0.45;
}

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

void main(void) {
  vec3 n = normalize(vNormal);
  vec3 v = normalize(cameraPosition - vWorldPos);
  vec3 lit = ambientColor + sunColor * band(max(dot(n, normalize(sunDir)), 0.0));
  vec3 spec = vec3(0.0);

  for (int i = 0; i < ${MAX_POINT_LIGHTS}; i++) {
    if (float(i) >= pointCount) break;
    vec3 toL = pointPos[i].xyz - vWorldPos;
    float d = length(toL);
    vec3 l = toL / max(d, 0.0001);
    float att = clamp(1.0 - d / pointPos[i].w, 0.0, 1.0);
    att *= att;
    float ndl = max(dot(n, l), 0.0);
    lit += pointColor[i].rgb * pointColor[i].a * band(ndl * att * 1.8);
    if (gloss > 0.0) {
      vec3 h = normalize(l + v);
      float s = pow(max(dot(n, h), 0.0), 18.0) * att;
      spec += pointColor[i].rgb * pointColor[i].a * smoothstep(0.18, 0.22, s) * gloss;
    }
  }

  vec3 color = baseColor * lit + spec + emissiveColor;

  float fres = 1.0 - max(dot(n, v), 0.0);
  color += rimColor * smoothstep(0.66, 0.7, fres) * rimStrength;

  if (windows > 0.5 && abs(n.y) < 0.5) {
    float u = abs(n.x) > 0.5 ? vWorldPos.z : vWorldPos.x;
    vec2 g = vec2(u / 2.4, (vWorldPos.y - 3.2) / 3.2);
    vec2 cell = floor(g);
    vec2 f = fract(g);
    float inWin = step(0.22, f.x) * step(f.x, 0.78) * step(0.3, f.y) * step(f.y, 0.75) * step(0.0, cell.y);
    float h = hash(cell + n.xz * 17.0);
    vec3 winColor = h > 0.9 ? vec3(0.4, 0.95, 1.0) : vec3(1.0, 0.7, 0.42);
    color = mix(color, winColor * 0.85, inWin * step(0.62, h));
  }

  float dist = length(cameraPosition - vWorldPos);
  float fog = 1.0 - exp(-pow(dist * fogDensity, 2.0));
  color = mix(color, fogColor, clamp(fog, 0.0, 1.0));
  gl_FragColor = vec4(color, 1.0);
}
`;
