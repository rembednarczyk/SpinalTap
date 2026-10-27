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
