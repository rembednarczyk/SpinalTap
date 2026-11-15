/**
 * Where the rain stands on the street (ADR-0084 stage 1): one mask for the ground, the neon's
 * streaks on it and the puddles of the dressing, in place of the value noise that covered half
 * the asphalt in sharp blots. The map city bakes two numbers into every vertex of its ground
 * (`renderer/mapcity/water-field.ts`): x = distance to the edge of the carriageway (m, the
 * gutter and the wheel ruts are read from it), y = how well the place holds water (0..1 from the
 * terrain's hollows and flats and the foot of steps; `WATER_NEVER` where none ever stands: zebras,
 * decks over the river, kerbs, walls). The shader and `standingWater` below draw the same shapes
 * from them; the noise is seeded by the position alone, so the mask is the same on every run.
 */

/** The field's hold where no water ever stands. */
export const WATER_NEVER = -1;
/** Distance to the carriageway's edge given where none is in reach (m): no gutter, no ruts. */
export const WATER_FAR = 16;
/** The field's x on the Old Town's setts: no kerb, small puddles between uneven stones all over. */
export const WATER_SETTS = 17;

/**
 * The field the streaks of the block city's signs and lamps read (no ground baked under them):
 * a street holding water like a flat stretch of asphalt off the gutter.
 */
export const STREET_FIELD_GLSL = `vec2(${WATER_FAR.toFixed(1)}, 0.6)`;

/** Darkening of wet paving: 36% darker (ADR-0084: 30-40%). */
export const WET_DARKEN = 0.64;

/** Width of a lane (m) and the wheel tracks in it from its side nearer the kerb. */
const LANE = 3.5;
const TRACKS = [0.95, 2.55] as const;
/** How much water the setts gather off their hollows. */
const SETTS_LEVEL = 0.16;

const smoothstep = (a: number, b: number, x: number): number => {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

const fract = (x: number): number => x - Math.floor(x);

/** Hash without a sine (stable far from the origin, alike in float and double): Hoskins' hash12. */
const hash = (x: number, z: number): number => {
  let px = fract(x * 0.1031);
  let pz = fract(z * 0.103);
  const d = px * (pz + 33.33) + pz * (px + 33.33);
  px += d;
  pz += d;
  return fract((px + pz) * px);
};

const noise = (x: number, z: number): number => {
  const ix = Math.floor(x);
  const iz = Math.floor(z);
  let fx = x - ix;
  let fz = z - iz;
  fx = fx * fx * (3 - 2 * fx);
  fz = fz * fz * (3 - 2 * fz);
  const a = hash(ix, iz);
  const b = hash(ix + 1, iz);
  const c = hash(ix, iz + 1);
  const d = hash(ix + 1, iz + 1);
  return a + (b - a) * fx + (c - a) * fz + (a - b - c + d) * fx * fz;
};

/** How much water a place gathers, 0 dry: the gutter strongest, then the hold, then the ruts. */
export const waterLevel = (kerb: number, hold: number): number => {
  if (hold < -0.5) return 0;
  if (kerb > WATER_SETTS - 0.5) return SETTS_LEVEL + 0.45 * hold;
  const gutter = 1 - smoothstep(0.3, 0.65, kerb);
  const t = (((kerb - 0.4) % LANE) + LANE) % LANE;
  let rut = 0;
  for (const c of TRACKS) rut = Math.max(rut, 1 - smoothstep(0.1, 0.28, Math.abs(t - c)));
  rut *= smoothstep(0.8, 1.2, kerb) * (1 - smoothstep(9, 11, kerb));
  return 0.46 * gutter + 0.2 * rut + 0.45 * hold;
};

/** The puddles' shapes: many small, a few large; on the setts only small ones. The same at a point on every run. */
export const waterNoise = (x: number, z: number, setts = false): number =>
  setts ? 0.55 * noise(x * 2.1 + 5, z * 2.1 + 5) + 0.45 * noise(x * 4.3 + 31, z * 4.3 + 31) : 0.62 * noise(x * 0.8, z * 0.8) + 0.38 * noise(x * 2.6 + 17, z * 2.6 + 17);

/** 1 in standing water, 0 on the merely wet street, 0.5 on the soft rim of a puddle (two cel steps). */
export const standingWater = (kerb: number, hold: number, x: number, z: number): number => {
  const s = smoothstep(0, 0.09, waterLevel(kerb, hold) - (1 - waterNoise(x, z, kerb > WATER_SETTS - 0.5)));
  return ((s >= 0.15 ? 1 : 0) + (s >= 0.85 ? 1 : 0)) * 0.5;
};

/** The same in GLSL: `waterStanding(field, xz)`, field as baked. */
export const WATER_GLSL = /* glsl */ `
float waterHash(vec2 q) {
  vec2 p = fract(q * vec2(0.1031, 0.103));
  float d = p.x * (p.y + 33.33) + p.y * (p.x + 33.33);
  p += d;
  return fract((p.x + p.y) * p.x);
}
float waterValue(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float a = waterHash(i);
  float b = waterHash(i + vec2(1.0, 0.0));
  float c = waterHash(i + vec2(0.0, 1.0));
  float d = waterHash(i + vec2(1.0, 1.0));
  return a + (b - a) * f.x + (c - a) * f.y + (a - b - c + d) * f.x * f.y;
}
float waterLevel(vec2 field) {
  if (field.y < -0.5) return 0.0;
  if (field.x > ${(WATER_SETTS - 0.5).toFixed(1)}) return ${SETTS_LEVEL.toFixed(2)} + 0.45 * field.y;
  float gutter = 1.0 - smoothstep(0.3, 0.65, field.x);
  float t = mod(field.x - 0.4, ${LANE.toFixed(1)});
  float rut = max(1.0 - smoothstep(0.1, 0.28, abs(t - ${TRACKS[0]})), 1.0 - smoothstep(0.1, 0.28, abs(t - ${TRACKS[1]})));
  rut *= smoothstep(0.8, 1.2, field.x) * (1.0 - smoothstep(9.0, 11.0, field.x));
  return 0.46 * gutter + 0.2 * rut + 0.45 * field.y;
}
float waterStanding(vec2 field, vec2 xz) {
  float n = field.x > ${(WATER_SETTS - 0.5).toFixed(1)}
    ? 0.55 * waterValue(xz * 2.1 + 5.0) + 0.45 * waterValue(xz * 4.3 + 31.0)
    : 0.62 * waterValue(xz * 0.8) + 0.38 * waterValue(xz * 2.6 + 17.0);
  float s = smoothstep(0.0, 0.09, waterLevel(field) - (1.0 - n));
  return (step(0.15, s) + step(0.85, s)) * 0.5;
}
`;

/** Rain in the joints of the Old Town's setts (their grid as `groundPaint` lays it), near the eye. */
export const SETT_JOINT_GLSL = /* glsl */ `
float settJoint(vec2 w, float dist) {
  vec2 g = vec2(w.x / 0.2 + 0.5 * step(0.5, fract(w.y / 0.24)), w.y / 0.12);
  vec2 f = fract(g);
  float joint = 1.0 - step(0.12, min(min(f.x, 1.0 - f.x) * 1.6, min(f.y, 1.0 - f.y) * 0.9));
  return joint * (1.0 - smoothstep(12.0, 35.0, dist));
}
`;
