/**
 * The look of a resident of the city (ADR-0041) from its seed: build, hair, clothes and their
 * colours, a neon trim now and then, a bag, the umbrella's colour. Pure and stable: the same seed
 * is always the same person. Palettes after the night streets of a cyberpunk Japantown: dark
 * streetwear, a few warm coats, neon accents.
 */

export type HairStyle = "short" | "long" | "bun" | "hood" | "cap";
export type Garment = "jacket" | "coat" | "skirt";

export interface CrowdColors {
  readonly skin: string;
  readonly hair: string;
  readonly top: string;
  readonly bottom: string;
  readonly shoes: string;
  readonly accent: string;
  readonly umbrella: string;
  readonly bag: string;
}

export interface CrowdLook {
  /** Standing height (m). */
  readonly height: number;
  /** Width of shoulders and hips against an average build. */
  readonly width: number;
  readonly female: boolean;
  readonly hair: HairStyle;
  readonly garment: Garment;
  readonly bag: boolean;
  /** A self-lit trim on the jacket (a neon stripe). */
  readonly trim: boolean;
  /** A self-lit rim on the umbrella (LED shaft). */
  readonly ledUmbrella: boolean;
  readonly colors: CrowdColors;
}

const SKIN = ["#f2dccd", "#ecc9ad", "#d9ad8a", "#b88463", "#8a5a3f", "#6a4330"] as const;
const HAIR = ["#151a2e", "#1b1b1f", "#2b211c", "#4a3326", "#6b4a2e", "#c9c9cf", "#b03a5a", "#3a7a9a", "#d8cfbd", "#7a2fd0"] as const;
const TOPS = ["#1d2027", "#2a2f3a", "#3a2433", "#24343a", "#46392c", "#6b2238", "#1f3b5a", "#5a5f68", "#c9c2b0", "#7a4a2a", "#2e4a2e", "#14161a", "#8a2a2a", "#3d3d55"] as const;
const COATS = ["#3b3328", "#6a5a44", "#1c1f26", "#4b2a2a", "#2c3a4a", "#8a7a62", "#232323"] as const;
const BOTTOMS = ["#15171c", "#23262d", "#33302b", "#2a3340", "#4a4e57", "#1c2a22", "#3a2a2a"] as const;
const SHOES = ["#0e0f12", "#2a2522", "#d8d8d8", "#5a2a22", "#1a1f2a"] as const;
const ACCENTS = ["#ff3d8b", "#5ff2ff", "#ffbf4a", "#9a7dff", "#59ff9b", "#ff6a3d"] as const;
const UMBRELLAS = ["#d9e3ea", "#d9e3ea", "#c23b4f", "#15171d", "#2f5f8a", "#e0b24a", "#5a2a6a", "#1f4a3a"] as const;
const BAGS = ["#1a1c21", "#3b2f25", "#5a1f2a", "#2a3a4a"] as const;

/** A small, fast generator over the seed (mulberry32): looks never touch any other randomness. */
const stream = (seed: number): (() => number) => {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

const pick = <T>(rand: () => number, list: readonly T[]): T => list[Math.min(list.length - 1, Math.floor(rand() * list.length))] as T;

export const crowdLook = (seed: number): CrowdLook => {
  const rand = stream(seed ^ 0x51ed270b);
  const female = rand() < 0.5;
  const height = female ? 1.52 + rand() * 0.2 : 1.64 + rand() * 0.24;
  const width = (female ? 0.86 : 0.96) + rand() * 0.2;
  const hairRoll = rand();
  const hair: HairStyle = hairRoll < 0.12 ? "hood" : hairRoll < 0.24 ? "cap" : female ? (hairRoll < 0.62 ? "long" : hairRoll < 0.8 ? "bun" : "short") : hairRoll < 0.85 ? "short" : "long";
  const gRoll = rand();
  const garment: Garment = gRoll < 0.3 ? "coat" : female && gRoll < 0.5 ? "skirt" : "jacket";
  const top = garment === "coat" ? pick(rand, COATS) : pick(rand, TOPS);
  return {
    height,
    width,
    female,
    hair,
    garment,
    bag: rand() < 0.35,
    trim: rand() < 0.22,
    ledUmbrella: rand() < 0.3,
    colors: {
      skin: pick(rand, SKIN),
      hair: hair === "hood" ? top : pick(rand, HAIR),
      top,
      bottom: pick(rand, BOTTOMS),
      shoes: pick(rand, SHOES),
      accent: pick(rand, ACCENTS),
      umbrella: pick(rand, UMBRELLAS),
      bag: pick(rand, BAGS),
    },
  };
};
