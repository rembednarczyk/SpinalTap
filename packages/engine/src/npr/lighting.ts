/** Scene-wide light rig shared by every toon material. */
export interface PointLightDef {
  readonly position: { x: number; y: number; z: number };
  readonly color: string;
  readonly range: number;
  readonly intensity: number;
  /**
   * The ground rectangle (world x, z) the light reaches, for a light behind walls: the shader's
   * point lights have no occlusion, so a room's lamp would light the street through its facade.
   * Without it the light reaches its whole range.
   */
  readonly clip?: LightClip;
}

export interface LightClip {
  readonly minX: number;
  readonly maxX: number;
  readonly minZ: number;
  readonly maxZ: number;
  /**
   * The storey it reaches (world y), for a lamp of a building of stacked floors (Alchemia's gallery):
   * without it a shop's lamp lights the floor and the shop over and under it through the slabs.
   */
  readonly minY?: number;
  readonly maxY?: number;
}

export interface LightingRig {
  readonly sunDir: { x: number; y: number; z: number };
  readonly sunColor: string;
  readonly ambient: string;
  readonly fogColor: string;
  readonly fogDensity: number;
  /** Multiplier for albedo on the shadow side (cool cel shadow paint). */
  readonly shadeTint: string;
  /** Colour of the character fill light. */
  readonly fillColor: string;
}

/**
 * Night over Lublin: cold moonlight, violet ambient, teal haze. The haze is thin enough for the
 * city's landmarks to read down a street (ADR-0045): Brama Krakowska from the deptak, about 70 m,
 * is half in the haze, the castle from Plac Zamkowy, about 100 m, three quarters.
 */
export const NIGHT_RIG: LightingRig = {
  sunDir: { x: -0.35, y: 0.8, z: -0.45 },
  sunColor: "#4d5f86",
  ambient: "#3b3550",
  fogColor: "#141d26",
  fogDensity: 0.0115,
  shadeTint: "#7d7ab2",
  fillColor: "#b9c6e0",
};

/** Overcast day over Lublin: flat grey-blue light, thin haze. The neon still carries the colour. */
export const DAY_RIG: LightingRig = {
  sunDir: NIGHT_RIG.sunDir,
  sunColor: "#c4cad6",
  ambient: "#80869a",
  fogColor: "#6f7e8c",
  fogDensity: 0.007,
  shadeTint: "#9496c2",
  fillColor: "#e2e7f0",
};

/**
 * Under a roof lit by its own lamps (W-3's hall, ADR-0082 §4): neither moon nor sun (a hard band of
 * it fell through the hall's walls, a patch on server room N's wall). Tessen's insides are dark
 * (the user's concept art, 17.11): a near-black ambient, so the light is the lamps' pools, the
 * strips and the screens, a cold shade side and a dense dark haze. The fill keeps people readable.
 * The same by day and by night.
 */
export const INDOOR_RIG: LightingRig = {
  sunDir: NIGHT_RIG.sunDir,
  sunColor: "#000000",
  ambient: "#1a1c23",
  fogColor: "#0b0e12",
  fogDensity: 0.018,
  shadeTint: "#7a8098",
  fillColor: "#9aa6bc",
};

/**
 * Alchemia's gallery and food hall at night (the user's note of 22.11: a moodier light). Its glass
 * shows the city, but under its slabs the moon does not reach: a warm, dim ambient (a plum dusk, the
 * shops' and lanterns' light bounced off tile), a dim warm key in the moon's place, a warm brown haze, a violet shade side, so
 * the light is the shops' glow, the gallery's sodium pools, the atrium's cyan strips and the food
 * hall's lanterns. Pattern: the "lighting by practicals" of film and level design, every light in
 * the scene coming from a visible source (Cyberpunk 2077's malls, Blade Runner's arcades).
 */
export const ALCHEMIA_NIGHT_RIG: LightingRig = {
  sunDir: NIGHT_RIG.sunDir,
  // The shops' and the city's light bounced in through the glass and down the atrium: a dim warm key, not the moon's cold one.
  sunColor: "#3c2a26",
  ambient: "#4b3a44",
  fogColor: "#221813",
  fogDensity: 0.012,
  shadeTint: "#8f74a2",
  fillColor: "#e6cdb4",
};

/** Alchemia by day: grey daylight through its glass and down its atrium, dimmer than the street's, still warm. */
export const ALCHEMIA_DAY_RIG: LightingRig = {
  sunDir: NIGHT_RIG.sunDir,
  sunColor: "#5c5a5e",
  ambient: "#625a5c",
  fogColor: "#4a4440",
  fogDensity: 0.009,
  shadeTint: "#9488b0",
  fillColor: "#ece0d2",
};

/**
 * The old town's rooms and Tessen's office (Neon Koi, the clinic, the pass office; `room-lights.ts`): small rooms lit by
 * their practicals, a street's neon through the windows at most. A dim plum ambient so the base stays dark (§13's 60%),
 * no moon, a faint warm key for the street's light through the glass, a dark haze; the fill keeps people readable.
 */
export const ROOM_RIG: LightingRig = {
  sunDir: NIGHT_RIG.sunDir,
  sunColor: "#2a2128",
  ambient: "#3a3242",
  fogColor: "#120e12",
  fogDensity: 0.014,
  shadeTint: "#86789e",
  fillColor: "#dcccc0",
};

/** Which interior's own light replaces the sky's: W-3's (ADR-0082 §4), Alchemia's, or a small room's. */
export type IndoorKind = "w3" | "alchemia" | "room";

const channel = (hex: string, i: number): number => parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16);

/** Mixes two "#rrggbb" colours. */
export const mixHex = (a: string, b: string, t: number): string =>
  `#${[0, 1, 2]
    .map((i) => Math.round(channel(a, i) + (channel(b, i) - channel(a, i)) * t).toString(16).padStart(2, "0"))
    .join("")}`;

/**
 * The light rig for a daylight level (0 night, 1 day; ADR-0017). Only colours and fog density
 * move; the moon direction stays, so shadows do not swing. Exactly NIGHT_RIG at 0.
 */
export const rigForDaylight = (daylight: number): LightingRig => {
  const t = Math.max(0, Math.min(1, daylight));
  if (t === 0) return NIGHT_RIG;
  if (t === 1) return DAY_RIG;
  return {
    sunDir: NIGHT_RIG.sunDir,
    sunColor: mixHex(NIGHT_RIG.sunColor, DAY_RIG.sunColor, t),
    ambient: mixHex(NIGHT_RIG.ambient, DAY_RIG.ambient, t),
    fogColor: mixHex(NIGHT_RIG.fogColor, DAY_RIG.fogColor, t),
    fogDensity: NIGHT_RIG.fogDensity + (DAY_RIG.fogDensity - NIGHT_RIG.fogDensity) * t,
    shadeTint: mixHex(NIGHT_RIG.shadeTint, DAY_RIG.shadeTint, t),
    fillColor: mixHex(NIGHT_RIG.fillColor, DAY_RIG.fillColor, t),
  };
};

/** Two rigs mixed: `a` at 0, `b` at 1 (the sun's direction stays `a`'s). */
export const mixRig = (a: LightingRig, b: LightingRig, t: number): LightingRig => {
  const k = Math.max(0, Math.min(1, t));
  if (k === 0) return a;
  if (k === 1) return { ...b, sunDir: a.sunDir };
  return {
    sunDir: a.sunDir,
    sunColor: mixHex(a.sunColor, b.sunColor, k),
    ambient: mixHex(a.ambient, b.ambient, k),
    fogColor: mixHex(a.fogColor, b.fogColor, k),
    fogDensity: a.fogDensity + (b.fogDensity - a.fogDensity) * k,
    shadeTint: mixHex(a.shadeTint, b.shadeTint, k),
    fillColor: mixHex(a.fillColor, b.fillColor, k),
  };
};

/** The interior's own rig at a daylight level: W-3's the same by day and night, Alchemia's with the daylight through its glass. */
export const indoorRig = (kind: IndoorKind, daylight: number): LightingRig =>
  kind === "w3" ? INDOOR_RIG : kind === "room" ? ROOM_RIG : mixRig(ALCHEMIA_NIGHT_RIG, ALCHEMIA_DAY_RIG, daylight);
