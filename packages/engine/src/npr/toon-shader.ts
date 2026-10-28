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
/** District rim colour (ADR-0030): rgb mixed over the preset rim by a. */
uniform vec4 rimTint;
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
/** City kit: brightness of self-lit swatches (1 at night, dimmer by day). */
uniform float selfLit;
#ifdef ENV_REFLECT
/** Static wet-asphalt probe (ADR-0036): neon, signs, far city and sky, seen from under the street. */
uniform samplerCube envSampler;
uniform float envStrength;
#endif

float band(float x) {
  return smoothstep(0.03, 0.07, x) * 0.55 + smoothstep(0.42, 0.47, x) * 0.45;
}

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

float vnoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
}

/** World coordinates across a face: (along, up) on walls, (x, z) on floors and roofs. */
vec2 facePlane(vec3 p, vec3 n) {
  vec3 a = abs(n);
  if (a.y > 0.5) return p.xz;
  return vec2(a.x > 0.5 ? p.z : p.x, p.y);
}

/** 1 on a line of half width w (metres) at every multiple of period, 0 elsewhere; hard edged. */
float gridLine(float x, float period, float w) {
  float d = abs(fract(x / period + 0.5) - 0.5) * period;
  return 1.0 - step(w, d);
}

#if defined(CONCRETE_PANELS) || defined(METAL_PANELS)
/**
 * Procedural surface of bare structures (ADR-0027): poured concrete with formwork seams, tie
 * holes and grime streaks, or ribbed sheet metal with panel seams, rivets and rust runs.
 * Stepped values, no gradients, so it reads as painted cels; fades out with distance.
 */
vec3 surfacePattern(vec3 albedo, vec3 p, vec3 n, float dist) {
  vec2 q = facePlane(p, n);
  float near = 1.0 - smoothstep(22.0, 55.0, dist);
  bool wall = abs(n.y) < 0.5;
  float k = 1.0;
#ifdef CONCRETE_PANELS
  float blotch = step(0.58, vnoise(q * 0.45 + 3.7));
  k -= 0.07 * blotch;
  float seam = max(gridLine(q.x, 1.8, 0.018), wall ? gridLine(q.y, 0.9, 0.014) : gridLine(q.y, 1.8, 0.018));
  vec2 c = fract(q / vec2(0.9, 0.45));
  float tie = wall ? (1.0 - step(0.035, length((c - 0.5) * vec2(0.9, 0.45)))) : 0.0;
  // Grime runs down from ledges and seams.
  float streak = wall ? step(0.66, vnoise(vec2(q.x * 2.2, q.y * 0.12 + 11.0))) * step(0.45, fract(q.y / 0.9)) : 0.0;
  k -= 0.1 * streak;
  k -= 0.32 * max(seam, tie) * near;
  // Damp foot of walls standing on the street.
  if (wall) k -= 0.12 * (1.0 - step(0.55, p.y));
  return albedo * max(k, 0.4);
#else
  if (wall) {
    float rib = step(0.5, fract(q.x / 0.22));
    k += (rib - 0.5) * 0.16 * near;
    float panel = max(gridLine(q.x, 2.4, 0.02), gridLine(q.y, 1.2, 0.02));
    float rivet = gridLine(q.y, 1.2, 0.06) * gridLine(q.x, 0.22, 0.03);
    k -= 0.35 * panel * near;
    k += 0.12 * rivet * near;
    float rust = step(0.62, vnoise(vec2(q.x * 1.3, q.y * 0.18 + 5.0)));
    vec3 col = mix(albedo, albedo * vec3(1.25, 0.82, 0.62), 0.55 * rust);
    return col * k;
  }
  // Floors: tread plate in a diamond lattice.
  float tread = gridLine(q.x + q.y, 0.18, 0.012) * gridLine(q.x - q.y, 0.18, 0.04);
  k += 0.14 * tread * near;
  k -= 0.3 * max(gridLine(q.x, 1.2, 0.015), gridLine(q.y, 1.2, 0.015)) * near;
  return albedo * k;
#endif
}
#endif

#ifdef CITYKIT
/**
 * Storefront glass of the city kit (ADR-0027): mullions, a transom and a kick plate, shelving
 * inside, a roller shutter half down on some bays and light falling off towards the top.
 */
vec3 shopGlass(vec3 glow, vec3 p, vec3 n) {
  vec2 q = facePlane(p, n);
  float bay = floor(q.x / 1.3);
  float h = hash(vec2(bay, 7.0));
  float y = q.y;
  float k = mix(1.15, 0.55, smoothstep(0.2, 3.2, y));
  // Shelves and goods behind the glass.
  k *= 1.0 - 0.35 * step(0.5, fract(y / 0.55)) * step(y, 2.0) * step(0.3, hash(vec2(bay, floor(y / 0.55))));
  // Roller shutter pulled half down on a few bays.
  float shutter = step(0.62, h) * step(2.6 - h * 1.4, y);
  k = mix(k, 0.16 + 0.1 * step(0.5, fract(y / 0.12)), shutter);
  vec3 col = glow * k;
  float frame = max(gridLine(q.x, 1.3, 0.045), max(gridLine(y - 2.35, 100.0, 0.05), gridLine(y - 0.32, 100.0, 0.04)));
  col = mix(col, vec3(0.03, 0.035, 0.045), frame);
  if (y < 0.28) col = vec3(0.05, 0.055, 0.065);
  return col;
}
#endif

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
#ifdef CITYKIT
  // City kit palette (ADR-0022): alpha 0.5 marks walls and paint tinted per building by the
  // vertex colour, alpha 0 self-lit windows and neon.
  float tinted = step(0.3, texel.a) * (1.0 - step(0.75, texel.a));
  float selfLitMask = 1.0 - step(0.25, texel.a);
#ifdef VERTEXCOLOR
  albedo *= mix(vec3(1.0), vColor.rgb, tinted);
#endif
#else
#ifdef VERTEXCOLOR
  albedo *= vColor.rgb;
#endif
#endif
  float dist = length(cameraPosition - vWorldPos);
#if defined(CONCRETE_PANELS) || defined(METAL_PANELS)
  albedo = surfacePattern(albedo, vWorldPos, n, dist);
#endif

  float g = gloss;
#if defined(DRESS_FLAGS) && defined(VERTEXCOLOR)
  // Dressing flags in the vertex alpha (ADR-0027): 1 painted, 0.5 wet, 0 self-lit.
  float wetFlag = step(0.25, vColor.a) * (1.0 - step(0.75, vColor.a));
  float litFlag = 1.0 - step(0.25, vColor.a);
  g = mix(gloss, 1.8, wetFlag);
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
    if (g > 0.0) {
      vec3 h = normalize(l + v);
      float s = pow(max(dot(n, h), 0.0), 18.0) * att;
      spec += pointColor[i].rgb * pointColor[i].a * smoothstep(0.18, 0.22, s) * g;
    }
  }

#ifdef ENV_REFLECT
  // Wet ground mirrors the probe in a few flat steps (cel paint), strongest in the puddles and
  // at grazing angles; walls and dry dressing stay matte.
  float wetK = min(g, 1.0);
#if defined(DRESS_FLAGS) && defined(VERTEXCOLOR)
  wetK = wetFlag;
#endif
  if (wetK > 0.4 && n.y > 0.6 && envStrength > 0.0) {
    vec3 r = reflect(-v, n);
    r.y = abs(r.y);
    // Only what glows: the sky's haze is cut away, neon and signs stay, in flat steps.
    vec3 env = max(textureCube(envSampler, r).rgb - vec3(0.18), vec3(0.0));
    env = floor(env * 6.0 + 0.3) / 6.0;
    float puddle = mix(0.15, 1.0, step(0.5, vnoise(vWorldPos.xz * 0.45)));
    float graze = 0.25 + 0.75 * pow(1.0 - max(dot(n, v), 0.0), 3.0);
    spec += env * envStrength * puddle * graze * wetK;
  }
#endif

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
  color += mix(rimColor, rimTint.rgb, rimTint.a) * smoothstep(0.66, 0.7, fres) * rimStrength * (0.35 + 0.65 * moon);

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

#ifdef CITYKIT
  // Lit windows and neon keep their colour and carry a little further through the haze.
  // Alpha just above 0 marks storefront glass, which gets frames and shelving.
  vec3 glowColor = texel.rgb;
  if (texel.a > 0.06 && texel.a < 0.25) glowColor = shopGlass(glowColor, vWorldPos, n);
  color = mix(color, glowColor * selfLit, selfLitMask);
#endif
  float fog = 1.0 - exp(-pow(dist * fogDensity, 2.0));
#ifdef CITYKIT
  fog *= 1.0 - 0.35 * selfLitMask;
#endif
#if defined(DRESS_FLAGS) && defined(VERTEXCOLOR)
  color = mix(color, vColor.rgb * selfLit, litFlag);
  fog *= 1.0 - 0.35 * litFlag;
#endif
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
