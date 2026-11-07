import { ACCENTS, BAGS, BOTTOMS, COATS, HAIR, SKIN, TOPS, lookStream, pick } from "./crowd-look";

/**
 * Variants of one imported model (ADR-0076 §3): another skin, hair and clothes over the same
 * file, another file's top or trousers of the same VRoid base, and accessories on the bones.
 * Pure: a variant is a number, and the same number is always the same look. The palettes are
 * the crowd's (`crowd-look.ts`), so the background and the sidewalk crowd belong together.
 */

/** Simple shapes on the head and chest bones of a dressed model. */
export type Accessory = "glasses" | "cap" | "mask" | "bag" | "apron";

export const ACCESSORIES: readonly Accessory[] = ["glasses", "cap", "mask", "bag", "apron"];

export interface Worn {
  readonly id: Accessory;
  readonly color: string;
}

export interface ModelVariant {
  /** Skin colour over the file's own (null: the file's). */
  readonly skin: string | null;
  /** Hair colour (null: the file's); the brows follow it. */
  readonly hair: string | null;
  /** Hue of the top and of the trousers or skirt over their texture's shading (null: the texture's own). */
  readonly top: string | null;
  readonly bottom: string | null;
  /** The top or trousers of another file of the same base, a fraction in [0, 1) picking which (null: the file's own). */
  readonly topFrom: number | null;
  readonly bottomFrom: number | null;
  readonly accessories: readonly Worn[];
}

/** A named character's hand-made changes over its seeded variant (manifest `dress`). */
export interface VariantDress {
  readonly skin?: string | null;
  readonly hair?: string | null;
  readonly top?: string | null;
  readonly bottom?: string | null;
  readonly topFrom?: number | null;
  readonly bottomFrom?: number | null;
  /** Replaces the seeded accessories: names (colours from the seed) or names with colours. */
  readonly accessories?: readonly (Accessory | Worn)[];
}

/** Variant 0: the file as it is. */
export const OWN_LOOK: ModelVariant = { skin: null, hair: null, top: null, bottom: null, topFrom: null, bottomFrom: null, accessories: [] };

/**
 * Variants the background draws from, 1..BACKGROUND_VARIANTS per file; the named characters
 * take theirs from 100 up in the manifest, so no passer-by wears a named character's look.
 */
export const BACKGROUND_VARIANTS = 16;

/** At most this many background variants of one file are dressed at once (materials, ADR-0076 §3). */
export const VARIANTS_PER_FILE = 4;

const GLASSES = ["#14161a", "#2a2522", "#5a5f68"] as const;
const MASKS = ["#14161a", "#1d2027", "#d9e3ea", ...ACCENTS] as const;
const APRONS = ["#e8e4da", "#2a2f3a", "#6b2238", "#46392c"] as const;

const ACCESSORY_COLOURS: Readonly<Record<Accessory, readonly string[]>> = {
  glasses: GLASSES,
  cap: [...TOPS, ...ACCENTS],
  mask: MASKS,
  bag: BAGS,
  apron: APRONS,
};

/** One round of a 32-bit integer mix: close numbers land far apart. */
const mix = (n: number): number => {
  let h = n >>> 0;
  h = Math.imul(h ^ (h >>> 16), 0x45d9f3b) >>> 0;
  h = Math.imul(h ^ (h >>> 16), 0x45d9f3b) >>> 0;
  return (h ^ (h >>> 16)) >>> 0;
};

/**
 * Accessories of a seeded variant: on the head or on the chest, never both (each group is one
 * mesh, so a character costs at most one draw more, ADR-0076 §5).
 */
const seededAccessories = (rand: () => number): Worn[] => {
  const roll = rand();
  const color = rand();
  const id: Accessory | null = roll < 0.2 ? "glasses" : roll < 0.34 ? "cap" : roll < 0.42 ? "mask" : roll < 0.6 ? "bag" : null;
  if (!id) return [];
  const list = ACCESSORY_COLOURS[id];
  return [{ id, color: list[Math.min(list.length - 1, Math.floor(color * list.length))]! }];
};

/** The colour an accessory takes in a variant without one given: fixed by the variant and the accessory. */
const colourOf = (id: number, accessory: Accessory): string => {
  const rand = lookStream(mix(id) ^ (0x2c1b3c6d + ACCESSORIES.indexOf(accessory)));
  return pick(rand, ACCESSORY_COLOURS[accessory]);
};

/** The seeded look of a variant number; 0 is the file's own. */
const seeded = (id: number): ModelVariant => {
  if (id === 0) return OWN_LOOK;
  const rand = lookStream(mix(id) ^ 0x7a3d91e5);
  const skin = pick(rand, SKIN);
  const hair = pick(rand, HAIR);
  const topRoll = rand();
  const top = topRoll < 0.45 ? pick(rand, TOPS) : topRoll < 0.7 ? pick(rand, COATS) : null;
  const bottomRoll = rand();
  const bottom = bottomRoll < 0.6 ? pick(rand, BOTTOMS) : null;
  const topFrom = rand() < 0.35 ? rand() : null;
  const bottomFrom = rand() < 0.35 ? rand() : null;
  return { skin, hair, top, bottom, topFrom, bottomFrom, accessories: seededAccessories(rand) };
};

const has = <K extends keyof VariantDress>(dress: VariantDress, key: K): boolean => Object.prototype.hasOwnProperty.call(dress, key);

/** The look of a variant number with a named character's changes over it. */
export const variantOf = (id: number, dress?: VariantDress): ModelVariant => {
  const base = seeded(Math.max(0, Math.floor(id)));
  if (!dress) return base;
  const field = <K extends "skin" | "hair" | "top" | "bottom" | "topFrom" | "bottomFrom">(key: K): ModelVariant[K] =>
    has(dress, key) ? ((dress[key] ?? null) as ModelVariant[K]) : base[key];
  const accessories = dress.accessories
    ? dress.accessories.filter((a) => ACCESSORIES.includes(typeof a === "string" ? a : a.id)).map((a) => (typeof a === "string" ? { id: a, color: colourOf(id, a) } : a))
    : base.accessories;
  return {
    skin: field("skin"),
    hair: field("hair"),
    top: field("top"),
    bottom: field("bottom"),
    topFrom: field("topFrom"),
    bottomFrom: field("bottomFrom"),
    accessories,
  };
};

/** The background variant a look seed asks for, 1..BACKGROUND_VARIANTS (independent of the pool's file draw). */
export const backgroundVariantOf = (look: number): number => 1 + (mix(look ^ 0x1f83d9ab) % BACKGROUND_VARIANTS);

/** A variant as text: two variants with the same text look the same. */
export const variantText = (v: ModelVariant): string =>
  [v.skin, v.hair, v.top, v.bottom, v.topFrom === null ? null : "t", v.bottomFrom === null ? null : "b", ...v.accessories.map((a) => `${a.id}:${a.color}`)].join("|");

/**
 * Which background variants of each file are dressed now (ADR-0076 §3): up to
 * `VARIANTS_PER_FILE` different ones; a further character takes the nearest of those.
 */
export class VariantBudget {
  private readonly worn = new Map<string, Map<number, number>>();

  constructor(private readonly limit = VARIANTS_PER_FILE) {}

  /** The variant a character of `file` asking for `wanted` wears; counted until `give`. */
  take(file: string, wanted: number): number {
    const counts = this.worn.get(file) ?? new Map<number, number>();
    this.worn.set(file, counts);
    let id = wanted;
    if (!counts.has(wanted) && counts.size >= this.limit) {
      id = [...counts.keys()].reduce((best, k) => (Math.abs(k - wanted) < Math.abs(best - wanted) || (Math.abs(k - wanted) === Math.abs(best - wanted) && k < best) ? k : best));
    }
    counts.set(id, (counts.get(id) ?? 0) + 1);
    return id;
  }

  give(file: string, id: number): void {
    const counts = this.worn.get(file);
    const n = counts?.get(id);
    if (!counts || n === undefined) return;
    if (n <= 1) counts.delete(id);
    else counts.set(id, n - 1);
  }

  /** Different variants of `file` dressed now. */
  countOf(file: string): number {
    return this.worn.get(file)?.size ?? 0;
  }
}
