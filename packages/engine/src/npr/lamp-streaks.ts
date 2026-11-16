/**
 * The street lamps' reflections on the wet street at night (ADR-0084 stage 1): each lamp near
 * the eye mirrored in the ground as one narrow streak running down towards the eye, broken into
 * flat steps like the rest of the cel paint. Drawn by the map city's ground itself (toon shader,
 * `WATER_MASK`), where the water mask is already known per pixel: bright in standing water, faint
 * on the merely wet street, none where water never lies. No mesh and no draw call of its own;
 * the lamps nearest the eye come as uniforms (`renderer/mapcity/lamp-streak-feed.ts`).
 *
 * The streak is where the eye's line, mirrored by the ground, meets the lamp within a small
 * angle: along the line to the eye the angles part slowly at a grazing view, so a far lamp's
 * streak is long and a near one's short; across, it stays a few degrees wide as seen from the eye.
 */

/** Lamps a ground pixel mirrors at most. */
export const MAX_LAMP_STREAKS = 8;
/** How far a mirrored ray may miss the lamp up or down and still catch its glow (rad). */
export const STREAK_PITCH = 0.2;
/** Half-width of the streak (m) at the eye and per metre away from it: a fixed angle as seen. */
export const STREAK_WIDTH = [0.04, 0.014] as const;
/** Length of the steps the streak is broken into along its run (m). */
export const STREAK_STEP = 0.4;
/** Lamps further than this from the eye (m) mirror nothing: they are lost in the fog. */
export const STREAK_REACH = 45;

export interface StreakPoint {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

const fract = (x: number): number => x - Math.floor(x);
/** Two numbers of a step of a lamp's streak, 0..1, alike in float and double. */
const stepHash = (k: number, seed: number): readonly [number, number] => [fract(Math.sin(k * 12.9898 + seed * 78.233) * 43758.5453), fract(Math.sin(k * 39.346 + seed * 11.135) * 24634.6345)];

/**
 * The streak of lamp `lamp` (its light, `seed` its own) at ground point `p` seen from `eye`:
 * 1 in its core, 0.5 in its rim, 0 off it, before the water says how much of it shows.
 */
export const lampStreak = (p: StreakPoint, lamp: StreakPoint, seed: number, eye: StreakPoint): number => {
  const dx = eye.x - lamp.x;
  const dz = eye.z - lamp.z;
  const d = Math.hypot(dx, dz);
  if (d < 1 || d > STREAK_REACH) return 0;
  const ux = dx / d;
  const uz = dz / d;
  const qx = p.x - lamp.x;
  const qz = p.z - lamp.z;
  const along = qx * ux + qz * uz;
  const s = d - along;
  const hl = lamp.y - p.y;
  const he = eye.y - p.y;
  if (along < 0.2 || s < 0.3 || hl <= 0 || he <= 0) return 0;
  const k = Math.floor(along / STREAK_STEP);
  const [h1, h2] = stepHash(k, seed);
  const w = (STREAK_WIDTH[0] + STREAK_WIDTH[1] * s) * (0.6 + 0.8 * h1);
  const x = Math.abs(-qx * uz + qz * ux - (h2 - 0.5) * w) / w;
  const y = Math.abs(Math.atan(he / s) - Math.atan(hl / along)) / STREAK_PITCH;
  return x < 0.5 && y < 0.4 ? 1 : x < 1 && y < 1 ? 0.5 : 0;
};

/** How much of a streak the ground shows: standing water all, its rim some, the wet street a faint one, never-wet ground none. */
export const streakShows = (standing: number, hold: number): number => (standing > 0.75 ? 1 : standing > 0.25 ? 0.55 : hold > -0.5 ? 0.4 : 0);

/** The same in GLSL: `lampStreaks(p, standing, hold)`, the lamps in `streakLamp` (xyz, w seed) and `streakColor`. */
export const LAMP_STREAK_GLSL = /* glsl */ `
uniform vec4 streakLamp[${MAX_LAMP_STREAKS}];
uniform vec4 streakColor[${MAX_LAMP_STREAKS}];
uniform float streakCount;
vec3 lampStreaks(vec3 p, float standing, float hold) {
  float shows = standing > 0.75 ? 1.0 : standing > 0.25 ? 0.55 : step(-0.5, hold) * 0.4;
  vec3 sum = vec3(0.0);
  if (shows <= 0.0) return sum;
  for (int i = 0; i < ${MAX_LAMP_STREAKS}; i++) {
    if (float(i) >= streakCount) break;
    vec3 lamp = streakLamp[i].xyz;
    vec2 u = cameraPosition.xz - lamp.xz;
    float d = length(u);
    if (d < 1.0 || d > ${STREAK_REACH.toFixed(1)}) continue;
    u /= d;
    vec2 q = p.xz - lamp.xz;
    float along = dot(q, u);
    float s = d - along;
    float hl = lamp.y - p.y;
    float he = cameraPosition.y - p.y;
    if (along < 0.2 || s < 0.3 || hl <= 0.0 || he <= 0.0) continue;
    float k = floor(along / ${STREAK_STEP.toFixed(2)});
    float seed = streakLamp[i].w;
    float h1 = fract(sin(k * 12.9898 + seed * 78.233) * 43758.5453);
    float h2 = fract(sin(k * 39.346 + seed * 11.135) * 24634.6345);
    float w = (${STREAK_WIDTH[0].toFixed(3)} + ${STREAK_WIDTH[1].toFixed(3)} * s) * (0.6 + 0.8 * h1);
    float x = abs(q.y * u.x - q.x * u.y - (h2 - 0.5) * w) / w;
    float y = abs(atan(he / s) - atan(hl / along)) / ${STREAK_PITCH.toFixed(3)};
    float core = step(x, 0.5) * step(y, 0.4);
    float rim = step(x, 1.0) * step(y, 1.0);
    sum += streakColor[i].rgb * (core + rim) * 0.5;
  }
  return sum * shows;
}
`;
