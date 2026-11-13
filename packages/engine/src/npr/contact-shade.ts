/**
 * Contact shade in the cel style (graphics backlog 13.11, step 2): corners, the feet of walls,
 * the ground under cars and benches and the underside of arcades darken in one hard step, the
 * way an anime background painter lays a shadow shape, not a soft realistic falloff.
 *
 * It is computed in the line-art pass from the same geometry buffer (linear view depth and
 * view-space normals), so it costs no pass and no draw call of its own: sixteen depth reads per
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

export const CONTACT_SHADE: ContactShade = { radius: 1.0, strength: 0.45, threshold: 0.22 };

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

/** GLSL: needs `depthAt`, `texel` and the uniforms `shadeParams` and `tanHalf`. */
export const CONTACT_SHADE_GLSL = /* glsl */ `
/** x: radius (m), y: strength (0 off), z: step threshold, w: fade-out distance (m). */
uniform vec4 shadeParams;
/** Tangents of half the view angles, across and up. */
uniform vec2 tanHalf;

vec3 viewPosAt(vec2 uv, float z) {
  return vec3((uv.x * 2.0 - 1.0) * tanHalf.x * z, (uv.y * 2.0 - 1.0) * tanHalf.y * z, z);
}

float contactShade(vec2 uv, float d, vec3 n) {
  if (shadeParams.y <= 0.0) return 0.0;
  vec3 p = viewPosAt(uv, d);
  float r = shadeParams.x;
  // The disc's radius on screen, as a fraction of the height and of the width.
  vec2 reach = vec2(r / (2.0 * tanHalf.x * d), r / (2.0 * tanHalf.y * d));
  // One pattern for every pixel: the edge of the shade stays a clean line, as a painted shadow,
  // instead of the grain a per-pixel rotation leaves around a hard step.
  float spin = 0.0;
  float occ = 0.0;
  for (int i = 0; i < 16; i++) {
    float t = (float(i) + 0.5) / 16.0;
    float a = spin + float(i) * 2.3999632;
    vec2 suv = uv + vec2(cos(a), sin(a)) * reach * sqrt(t);
    float sd = depthAt(suv);
    if (sd <= 0.0) continue;
    vec3 v = viewPosAt(suv, sd) - p;
    float l2 = dot(v, v);
    // A sample shades when it stands over the surface (more than ~17 degrees up from it) within reach:
    // the share of such samples, not a weighted mean, so a wall's foot reaches the step at all.
    occ += (dot(n, v) * inversesqrt(l2 + 1e-4) > 0.3 && l2 < r * r) ? 1.0 : 0.0;
  }
  occ /= 16.0;
  float shade = smoothstep(shadeParams.z, shadeParams.z + 0.03, occ);
  return shade * shadeParams.y * (1.0 - smoothstep(shadeParams.w * 0.55, shadeParams.w, d));
}
`;
