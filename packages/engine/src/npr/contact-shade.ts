import { normalDecodeGlsl } from "./gbuffer-formats";

/**
 * Contact shade in the cel style (graphics backlog 13.11, step 2): corners, the feet of walls,
 * the ground under cars and benches and the underside of arcades darken in one hard step, the
 * way an anime background painter lays a shadow shape, not a soft realistic falloff.
 *
 * It is computed in the line-art pass from the same geometry buffer (linear view depth and
 * view-space normals), so it costs no pass and no draw call of its own: twenty-four depth reads per
 * pixel around a disc whose radius is a fixed distance in the world.
 */

/** Shading of one quality tier, or null when off. */
export interface ContactShade {
  /** Reach in metres: occluders further away do not shade. */
  readonly radius: number;
  /** How dark the shade gets, 0..1. */
  readonly strength: number;
  /** Share of the samples (0..1) standing over the point where the hard step lies. */
  readonly threshold: number;
}

export const CONTACT_SHADE: ContactShade = { radius: 1.0, strength: 0.6, threshold: 0.18 };

/** Cool shadow tint the shade multiplies by (the moon shadow's family of colours). */
export const CONTACT_SHADE_TINT = [0.42, 0.47, 0.6] as const;

/**
 * Tangents of half the view angles (x across, y up) from the camera's field of view, which may
 * be fixed horizontally (ADR-0049) or vertically.
 */
export const halfTangents = (fov: number, horizontalFixed: boolean, width: number, height: number): readonly [number, number] => {
  const t = Math.tan(fov / 2);
  const aspect = width / Math.max(1, height);
  return horizontalFixed ? [t, t / aspect] : [t * aspect, t];
};

/**
 * Samples per pixel of the occlusion pass. 12, not 24: the user reported stutter on High, and the
 * 4x4 spin and blur keep the shade smooth at half the samples (the golden-angle spiral still
 * covers the disc; the share steps by 1/12 under the 0.18 threshold).
 */
export const CONTACT_SAMPLES = 12;

/** GLSL: needs `depthAt` and the uniforms `shadeParams` and `tanHalf`. */
export const CONTACT_SHADE_GLSL = /* glsl */ `
/** x: radius (m), y: strength (0 off), z: step threshold, w: fade-out distance (m). */
uniform vec4 shadeParams;
/** Tangents of half the view angles, across and up. */
uniform vec2 tanHalf;
/** World up in view space: the shade lands on floors only, where every contact ends. */
uniform vec3 upView;

vec3 viewPosAt(vec2 uv, float z) {
  return vec3((uv.x * 2.0 - 1.0) * tanHalf.x * z, (uv.y * 2.0 - 1.0) * tanHalf.y * z, z);
}

/** Share of the samples (0..1) that stand over the point within reach, faded with distance. */
float contactOcclusion(vec2 uv, float d, vec3 n) {
  // Walls, beams and steps' risers take no shade: that is where the stairs and ceilings smeared
  // it; the foot of a wall still shades the floor in front of it.
  float floorness = smoothstep(0.6, 0.85, dot(n, upView));
  if (floorness <= 0.0) return 0.0;
  vec3 p = viewPosAt(uv, d);
  float r = shadeParams.x;
  // The disc's radius on screen, as a fraction of the width and of the height.
  vec2 reach = vec2(r / (2.0 * tanHalf.x * d), r / (2.0 * tanHalf.y * d));
  // A rotation from a 4x4 ordered pattern of this pass's pixels: the 4x4 blur after it averages
  // exactly one period, so the pattern cancels instead of leaving a screen-tone grain.
  vec2 cell = mod(floor(gl_FragCoord.xy), 4.0);
  // Bayer 4x4 from the 2x2 one ([0 2; 3 1] = (2x + 3y) mod 4): a permutation of 0..15 over the cell.
  vec2 lo = mod(cell, 2.0);
  vec2 hi = floor(cell / 2.0);
  float bayer = 4.0 * mod(2.0 * lo.x + 3.0 * lo.y, 4.0) + mod(2.0 * hi.x + 3.0 * hi.y, 4.0);
  float spin = 6.2831853 * (bayer + 0.5) / 16.0;
  float occ = 0.0;
  for (int i = 0; i < ${CONTACT_SAMPLES}; i++) {
    float t = (float(i) + 0.5) / ${CONTACT_SAMPLES}.0;
    float a = spin + float(i) * 2.3999632;
    vec2 suv = uv + vec2(cos(a), sin(a)) * reach * sqrt(t);
    float sd = depthAt(suv);
    if (sd <= 0.0) continue;
    vec3 v = viewPosAt(suv, sd) - p;
    float l2 = dot(v, v);
    // A sample shades when it stands over the surface (more than ~17 degrees up from it) within
    // reach: the share of such samples, not a weighted mean, so a wall's foot reaches the step.
    occ += (dot(n, v) * inversesqrt(l2 + 1e-4) > 0.3 && l2 < r * r) ? 1.0 : 0.0;
  }
  return floorness * occ / ${CONTACT_SAMPLES}.0 * (1.0 - smoothstep(shadeParams.w * 0.55, shadeParams.w, d));
}
`;

/**
 * Pass 1 (full-resolution input, half-resolution output): the raw share of occluding samples.
 * With `encodedNormals` the normals are stored as n * 0.5 + 0.5 (RGB10_A2).
 */
export const contactOcclusionFragment = (encodedNormals: boolean): string => /* glsl */ `
precision highp float;
varying vec2 vUV;
uniform sampler2D depthSampler;
uniform sampler2D normalSampler;
float depthAt(vec2 uv) { return texture2D(depthSampler, uv).r; }
${normalDecodeGlsl(encodedNormals)}
${CONTACT_SHADE_GLSL}
void main(void) {
  float d = depthAt(vUV);
  if (d <= 0.0) { gl_FragColor = vec4(0.0); return; }
  vec3 n = decodeNormal(texture2D(normalSampler, vUV));
  gl_FragColor = vec4(contactOcclusion(vUV, d, n), 0.0, 0.0, 1.0);
}
`;

/**
 * Pass 2 (half resolution): a 4x4 box blur (one period of the occlusion pass's rotation pattern) that keeps to one surface (weights fall with the relative
 * depth difference), so the shade's edge comes out smooth for the hard step without bleeding
 * across a silhouette.
 */
export const CONTACT_BLUR_FRAGMENT = /* glsl */ `
precision highp float;
varying vec2 vUV;
uniform sampler2D textureSampler;
uniform sampler2D depthSampler;
uniform vec2 texel;
void main(void) {
  float d = texture2D(depthSampler, vUV).r;
  if (d <= 0.0) { gl_FragColor = vec4(0.0); return; }
  float sum = 0.0;
  float wsum = 0.0;
  for (int y = 0; y < 4; y++) {
    for (int x = 0; x < 4; x++) {
      vec2 uv = vUV + (vec2(float(x), float(y)) - 1.5) * texel;
      float sd = texture2D(depthSampler, uv).r;
      // Equal weights over the period, times staying on the same surface (relative depth difference).
      float w = exp(-abs(sd - d) / (0.03 * d + 1e-3));
      sum += texture2D(textureSampler, uv).r * w;
      wsum += w;
    }
  }
  gl_FragColor = vec4(sum / max(wsum, 1e-4), 0.0, 0.0, 1.0);
}
`;
