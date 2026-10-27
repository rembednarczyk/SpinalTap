/** Scene-wide light rig shared by every toon material. */
export interface PointLightDef {
  readonly position: { x: number; y: number; z: number };
  readonly color: string;
  readonly range: number;
  readonly intensity: number;
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

/** Night in Shinsekai: cold moonlight, violet ambient, teal haze. */
export const NIGHT_RIG: LightingRig = {
  sunDir: { x: -0.35, y: 0.8, z: -0.45 },
  sunColor: "#4d5f86",
  ambient: "#3b3550",
  fogColor: "#141d26",
  fogDensity: 0.021,
  shadeTint: "#7d7ab2",
  fillColor: "#b9c6e0",
};

/** Overcast day over Shinsekai: flat grey-blue light, thin haze. The neon still carries the colour. */
export const DAY_RIG: LightingRig = {
  sunDir: NIGHT_RIG.sunDir,
  sunColor: "#c4cad6",
  ambient: "#80869a",
  fogColor: "#6f7e8c",
  fogDensity: 0.011,
  shadeTint: "#9496c2",
  fillColor: "#e2e7f0",
};

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
