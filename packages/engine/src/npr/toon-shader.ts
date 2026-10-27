/** Number of point lights the toon shader evaluates per fragment. */
export const MAX_POINT_LIGHTS = 8;

/**
 * Shared vertex stage. Supports Babylon instancing and GPU skinning through the standard
 * includes (ShaderMaterial injects INSTANCES / NUM_BONE_INFLUENCERS defines per mesh), so
 * imported glTF characters use the same material as procedural ones.
 */
export const TOON_VERTEX = /* glsl */ `
precision highp float;
attribute vec3 position;
attribute vec3 normal;
#ifdef UV1
attribute vec2 uv;
varying vec2 vUV;
#endif
#ifdef VERTEXCOLOR
attribute vec4 color;
varying vec4 vColor;
#endif
#include<instancesDeclaration>
#include<bonesDeclaration>
#include<morphTargetsVertexGlobalDeclaration>
#include<morphTargetsVertexDeclaration>[0..maxSimultaneousMorphTargets]
uniform mat4 viewProjection;
uniform mat4 shadowMatrix;
varying vec3 vWorldPos;
varying vec3 vNormal;
varying vec4 vShadowPos;

void main(void) {
  // Face expressions of imported models (blink, mouth) move positions only.
  vec3 positionUpdated = position;
  vec3 normalUpdated = normal;
#include<morphTargetsVertexGlobal>
#include<morphTargetsVertex>[0..maxSimultaneousMorphTargets]
#include<instancesVertex>
#include<bonesVertex>
  vec4 wp = finalWorld * vec4(positionUpdated, 1.0);
  vWorldPos = wp.xyz;
  vNormal = normalize(mat3(finalWorld) * normalUpdated);
  vShadowPos = shadowMatrix * wp;
#ifdef UV1
  vUV = uv;
#endif
#ifdef VERTEXCOLOR
  vColor = color;
#endif
  gl_Position = viewProjection * wp;
}
`;

/**
 * Cel shading after 1990s anime: two hard light bands, a hard moon shadow (cast shadow and
 * terminator share one cool shadow colour), hard rim light, stepped highlights from street
 * lights on wet surfaces, procedural lit windows on facades and distance fog.
 */
export const TOON_FRAGMENT = /* glsl */ `
precision highp float;
varying vec3 vWorldPos;
varying vec3 vNormal;
varying vec4 vShadowPos;
#ifdef UV1
varying vec2 vUV;
#endif
#ifdef VERTEXCOLOR
varying vec4 vColor;
#endif
#ifdef TEXTURE
uniform sampler2D baseSampler;
#endif

uniform vec3 cameraPosition;
uniform vec3 baseColor;
uniform vec3 emissiveColor;
uniform vec3 shadeColor;
uniform vec3 sunDir;
uniform vec3 sunColor;
uniform vec3 ambientColor;
uniform vec3 rimColor;
uniform float rimStrength;
uniform float gloss;
uniform float windows;
/** Character fill light: a banded key from the camera side so faces read at night. */
uniform float fill;
uniform vec3 fillColor;
uniform vec3 fogColor;
uniform float fogDensity;
uniform vec4 pointPos[${MAX_POINT_LIGHTS}];
uniform vec4 pointColor[${MAX_POINT_LIGHTS}];
uniform float pointCount;
uniform sampler2D shadowSampler;
/** x: depth bias, y: texel size, z: shadow strength (0 disables). */
uniform vec3 shadowParams;
/** Muzzle flash: xyz position, w intensity (0 = off). Warm, short range, no shadow. */
uniform vec4 flashLight;

float band(float x) {
  return smoothstep(0.03, 0.07, x) * 0.55 + smoothstep(0.42, 0.47, x) * 0.45;
}

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

float shadowTap(vec2 uv, float d) {
  return step(d, texture2D(shadowSampler, uv).r);
}

/** 1 = lit by the moon, 0 = in shadow. Bilinear PCF, then sharpened back to a hard cel edge. */
float moonShadow() {
  if (shadowParams.z <= 0.0) return 1.0;
  vec3 p = vShadowPos.xyz / vShadowPos.w;
  vec2 uv = p.xy * 0.5 + 0.5;
  if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) return 1.0;
  float d = p.z * 0.5 + 0.5 - shadowParams.x;
  float t = shadowParams.y;
  vec2 tc = uv / t - 0.5;
  vec2 f = fract(tc);
  vec2 base = (floor(tc) + 0.5) * t;
  float s00 = shadowTap(base, d);
  float s10 = shadowTap(base + vec2(t, 0.0), d);
  float s01 = shadowTap(base + vec2(0.0, t), d);
  float s11 = shadowTap(base + vec2(t, t), d);
  float lit = mix(mix(s00, s10, f.x), mix(s01, s11, f.x), f.y);
  return mix(1.0, smoothstep(0.4, 0.6, lit), shadowParams.z);
}

void main(void) {
  vec3 n = normalize(vNormal);
  if (!gl_FrontFacing) n = -n;
  vec3 v = normalize(cameraPosition - vWorldPos);

  vec3 albedo = baseColor;
#ifdef TEXTURE
  vec4 texel = texture2D(baseSampler, vUV);
#ifdef ALPHATEST
  // Cut-out hair strands, lashes and brows; the toon pass stays opaque.
  if (texel.a < 0.5) albedo = vec3(1.0, 0.0, 1.0);
#endif
#ifdef TINT
  // Garment colour (ADR-0015 E7): the cloth's shading kept as brightness, the hue from baseColor.
  albedo *= 0.3 + 0.85 * dot(texel.rgb, vec3(0.299, 0.587, 0.114));
#else
  albedo *= texel.rgb;
#endif
#endif
#ifdef VERTEXCOLOR
  albedo *= vColor.rgb;
#endif

  float moon = band(max(dot(n, normalize(sunDir)), 0.0)) * moonShadow();
  vec3 lit = ambientColor * (1.0 + fill) + sunColor * moon;
  if (fill > 0.0) {
    vec3 key = normalize(v + vec3(0.0, 0.35, 0.0));
    // Wrapped: anything roughly facing the camera lands in the lit band (flat anime faces).
    float k = band(max(dot(n, key), 0.0) * 0.6 + 0.4 * step(0.0, dot(n, v)));
    lit += fillColor * k * fill;
    moon = max(moon, k * fill * 0.8);
  }
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

  if (flashLight.w > 0.0) {
    vec3 toF = flashLight.xyz - vWorldPos;
    float fd = length(toF);
    float fatt = clamp(1.0 - fd / 9.0, 0.0, 1.0);
    lit += vec3(1.0, 0.78, 0.45) * flashLight.w * band(max(dot(n, toF / max(fd, 0.001)), 0.0) * fatt * fatt * 2.0) * 1.6;
  }

  // Shadow side takes a cool tint instead of just getting darker (cel paint convention).
  vec3 paint = mix(albedo * shadeColor, albedo, clamp(moon, 0.0, 1.0));
  vec3 color = paint * lit + spec + emissiveColor;

  float fres = 1.0 - max(dot(n, v), 0.0);
  color += rimColor * smoothstep(0.66, 0.7, fres) * rimStrength * (0.35 + 0.65 * moon);

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
#if defined(ALPHABLEND) && defined(TEXTURE)
  gl_FragColor = vec4(color, texel.a);
#else
  gl_FragColor = vec4(color, 1.0);
#endif
}
`;

/** Depth-only pass from the moon's orthographic camera. Same skinning path as the toon shader. */
export const SHADOW_DEPTH_VERTEX = /* glsl */ `
precision highp float;
attribute vec3 position;
#include<instancesDeclaration>
#include<bonesDeclaration>
#include<morphTargetsVertexGlobalDeclaration>
#include<morphTargetsVertexDeclaration>[0..maxSimultaneousMorphTargets]
uniform mat4 viewProjection;
varying float vDepth;

void main(void) {
  vec3 positionUpdated = position;
#include<morphTargetsVertexGlobal>
#include<morphTargetsVertex>[0..maxSimultaneousMorphTargets]
#include<instancesVertex>
#include<bonesVertex>
  gl_Position = viewProjection * finalWorld * vec4(positionUpdated, 1.0);
  vDepth = gl_Position.z / gl_Position.w * 0.5 + 0.5;
}
`;

export const SHADOW_DEPTH_FRAGMENT = /* glsl */ `
precision highp float;
varying float vDepth;

void main(void) {
  gl_FragColor = vec4(vDepth, 0.0, 0.0, 1.0);
}
`;
