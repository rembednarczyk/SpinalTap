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

/** Darkening of wet paving: 36% darker (ADR-0084: 30-40%). */
export const WET_DARKEN = 0.64;

/** Width of a lane (m) and the wheel tracks in it from its side nearer the kerb. */
const LANE = 3.5;
const TRACKS = [0.95, 2.55] as const;

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
  const gutter = 1 - smoothstep(0.3, 0.65, kerb);
  const t = (((kerb - 0.4) % LANE) + LANE) % LANE;
  let rut = 0;
  for (const c of TRACKS) rut = Math.max(rut, 1 - smoothstep(0.1, 0.28, Math.abs(t - c)));
  rut *= smoothstep(0.8, 1.2, kerb) * (1 - smoothstep(9, 11, kerb));
  return 0.62 * gutter + 0.2 * rut + 0.5 * hold;
};

/** The puddles' shapes: many small, a few large, the same at a point on every run. */
export const waterNoise = (x: number, z: number): number => 0.62 * noise(x * 0.8, z * 0.8) + 0.38 * noise(x * 2.6 + 17, z * 2.6 + 17);

/** 1 in standing water, 0 on the merely wet street, 0.5 on the soft rim of a puddle (two cel steps). */
export const standingWater = (kerb: number, hold: number, x: number, z: number): number => {
  const s = smoothstep(0, 0.09, waterLevel(kerb, hold) - (1 - waterNoise(x, z)));
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
  float gutter = 1.0 - smoothstep(0.3, 0.65, field.x);
  float t = mod(field.x - 0.4, ${LANE.toFixed(1)});
  float rut = max(1.0 - smoothstep(0.1, 0.28, abs(t - ${TRACKS[0]})), 1.0 - smoothstep(0.1, 0.28, abs(t - ${TRACKS[1]})));
  rut *= smoothstep(0.8, 1.2, field.x) * (1.0 - smoothstep(9.0, 11.0, field.x));
  return 0.62 * gutter + 0.2 * rut + 0.5 * field.y;
}
float waterStanding(vec2 field, vec2 xz) {
  float n = 0.62 * waterValue(xz * 0.8) + 0.38 * waterValue(xz * 2.6 + 17.0);
  float s = smoothstep(0.0, 0.09, waterLevel(field) - (1.0 - n));
  return (step(0.15, s) + step(0.85, s)) * 0.5;
}
`;
