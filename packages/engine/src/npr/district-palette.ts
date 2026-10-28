import { type ChunkDef, type DistrictId, WORLD_CHUNKS, distanceToRect } from "@seki/sim";
import { DAY_RIG, type LightingRig, mixHex } from "./lighting";

/**
 * Colour script per district (ADR-0030): the tone of the grade, the night haze, the colour of
 * the rim light and the saturation. Pure data; the renderer blends between two of them when the
 * camera crosses into another district and pushes the result into the grade (ColorCurves), the
 * toon materials (fog, ambient, rim), the sky and the far city.
 */
export interface DistrictPalette {
  /** Night haze: toon fog, sky at the horizon, far city haze. */
  readonly fog: string;
  /** Night ambient (the cel shadow side is lit by it). */
  readonly ambient: string;
  /** Rim light colour, mixed over each preset's own rim by `rimWeight`. */
  readonly rim: string;
  readonly rimWeight: number;
  /** Global saturation of the grade, ColorCurves units (-100..100). */
  readonly saturation: number;
  /** Shadow and highlight tones of the grade: hue in degrees, density and saturation 0..100. */
  readonly shadows: Tone;
  readonly highlights: Tone;
}

export interface Tone {
  readonly hue: number;
  readonly density: number;
  readonly saturation: number;
}

export const DISTRICT_PALETTES: Readonly<Record<DistrictId, DistrictPalette>> = {
  // Shinsekai 7: pink-violet. The neon of the bars bleeds into a violet haze.
  "shinsekai-7": {
    fog: "#1a1627",
    ambient: "#433658",
    rim: "#ff8ad6",
    rimWeight: 0.55,
    saturation: -12,
    shadows: { hue: 272, density: 40, saturation: 30 },
    highlights: { hue: 325, density: 18, saturation: 16 },
  },
  // Ulica Kanałowa: the old teal of the canal, wet concrete, cold cyan rims.
  kanal: {
    fog: "#122029",
    ambient: "#34405a",
    rim: "#7fe6ff",
    rimWeight: 0.45,
    saturation: -16,
    shadows: { hue: 192, density: 36, saturation: 26 },
    highlights: { hue: 38, density: 12, saturation: 10 },
  },
  // The market: amber and red, lantern light and grill smoke.
  targ: {
    fog: "#25170f",
    ambient: "#4f3634",
    rim: "#ffae55",
    rimWeight: 0.55,
    saturation: -6,
    shadows: { hue: 356, density: 36, saturation: 30 },
    highlights: { hue: 38, density: 34, saturation: 28 },
  },
  // The docks: cold blue haze over the water, sodium-orange floodlights.
  doki: {
    fog: "#0e1a2b",
    ambient: "#2f3b57",
    rim: "#ff9d42",
    rimWeight: 0.6,
    saturation: -20,
    shadows: { hue: 214, density: 46, saturation: 36 },
    highlights: { hue: 30, density: 40, saturation: 36 },
  },
};

/** Seconds a change of district takes to blend through. */
export const PALETTE_BLEND_SECONDS = 2.5;

/**
 * District named for a point, as the simulation names it (streaming bounds overlap at the seams,
 * so the last chunk in table order wins). Null outside every chunk.
 */
export const districtAt = (x: number, z: number, chunks: readonly ChunkDef[] = WORLD_CHUNKS): DistrictId | null => {
  for (let i = chunks.length - 1; i >= 0; i--) {
    const c = chunks[i];
    if (c && distanceToRect(x, z, c.bounds) === 0) return c.district;
  }
  return null;
};

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** Hue in degrees along the shorter way round the circle, in [0, 360). */
export const lerpHue = (a: number, b: number, t: number): number => {
  const d = ((((b - a) % 360) + 540) % 360) - 180;
  return (((a + d * t) % 360) + 360) % 360;
};

const lerpTone = (a: Tone, b: Tone, t: number): Tone => ({
  hue: lerpHue(a.hue, b.hue, t),
  density: lerp(a.density, b.density, t),
  saturation: lerp(a.saturation, b.saturation, t),
});

export const lerpPalette = (a: DistrictPalette, b: DistrictPalette, t: number): DistrictPalette => {
  const k = Math.max(0, Math.min(1, t));
  if (k === 0) return a;
  if (k === 1) return b;
  return {
    fog: mixHex(a.fog, b.fog, k),
    ambient: mixHex(a.ambient, b.ambient, k),
    rim: mixHex(a.rim, b.rim, k),
    rimWeight: lerp(a.rimWeight, b.rimWeight, k),
    saturation: lerp(a.saturation, b.saturation, k),
    shadows: lerpTone(a.shadows, b.shadows, k),
    highlights: lerpTone(a.highlights, b.highlights, k),
  };
};

/**
 * The light rig of the time of day with the district's night colours: haze and ambient follow
 * the palette at night and give way to the overcast day rig as daylight comes up.
 */
export const rigWithPalette = (rig: LightingRig, palette: DistrictPalette, daylight: number): LightingRig => {
  const t = Math.max(0, Math.min(1, daylight));
  return { ...rig, fogColor: mixHex(palette.fog, DAY_RIG.fogColor, t), ambient: mixHex(palette.ambient, DAY_RIG.ambient, t) };
};

/**
 * Eased blend from one palette to the next. A new target mid-way starts from what is on screen,
 * so walking back and forth over a seam never jumps.
 */
export class PaletteBlend {
  private from: DistrictPalette;
  private to: DistrictPalette;
  private t = 1;
  private current: DistrictPalette;

  constructor(
    start: DistrictPalette,
    private readonly seconds = PALETTE_BLEND_SECONDS,
  ) {
    this.from = start;
    this.to = start;
    this.current = start;
  }

  get value(): DistrictPalette {
    return this.current;
  }

  get target(): DistrictPalette {
    return this.to;
  }

  /** Starts a blend towards `next`; `snap` jumps there at once (new game, load, teleport). */
  retarget(next: DistrictPalette, snap = false): void {
    if (snap) {
      this.from = next;
      this.to = next;
      this.current = next;
      this.t = 1;
      return;
    }
    if (next === this.to) return;
    this.from = this.current;
    this.to = next;
    this.t = 0;
  }

  /** Advances the blend; true when the palette on screen changed. */
  update(dt: number): boolean {
    if (this.t >= 1) return false;
    this.t = Math.min(1, this.t + dt / this.seconds);
    const e = this.t * this.t * (3 - 2 * this.t);
    this.current = this.t >= 1 ? this.to : lerpPalette(this.from, this.to, e);
    return true;
  }
}
