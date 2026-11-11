/**
 * The barriers of the map city (ADR-0077 point 4): walls, retaining walls, the city walls,
 * fences and hedges from the map's lines, and their gates. The simulation lays each line as
 * street pieces of kind `barrier`, one a straight stretch of at most `BARRIER_PIECE` metres,
 * whose variant holds the kind, the length, the height and the ground's rise along it, so the
 * simulation that collides with them, the renderer that draws them and the glitch scan read one
 * layout.
 */

/** What a barrier is: the solid kinds, then the openings (drawn, no solid). */
export const BARRIER_KINDS = ["wall", "retaining-wall", "city-wall", "fence", "hedge", "gate", "lift-gate"] as const;
export type BarrierKind = (typeof BARRIER_KINDS)[number];

/** The openings: drawn posts (and a lift gate's raised arm), no solid. */
export const BARRIER_OPENINGS: ReadonlySet<BarrierKind> = new Set(["gate", "lift-gate"]);

/**
 * What sight passes through (ADR-0077): a fence's bars, a hedge's leaves, an opening. Only the
 * walls stop the eye; every solid kind stops a body.
 */
export const SEE_THROUGH_BARRIERS: ReadonlySet<BarrierKind> = new Set(["fence", "hedge", "gate", "lift-gate"]);

/** How thick each kind stands (m): a wall, a retaining wall's face, the city walls, a fence's posts, a hedge. */
export const BARRIER_THICKNESS: Readonly<Record<BarrierKind, number>> = {
  wall: 0.3,
  "retaining-wall": 0.4,
  "city-wall": 0.9,
  fence: 0.12,
  hedge: 0.8,
  gate: 0.12,
  "lift-gate": 0.12,
};

/** What a barrier is built of, as the renderer tells them apart; `plain` is the kind's own look. */
export const BARRIER_MATERIALS = ["plain", "brick", "stone", "concrete", "wood", "metal"] as const;
export type BarrierMaterial = (typeof BARRIER_MATERIALS)[number];

/** The material of the map's `material` (or a fence's `fence_type`) tag. */
export const barrierMaterial = (tag: string | undefined): BarrierMaterial => {
  if (tag === "brick" || tag === "bricks") return "brick";
  if (tag === "stone" || tag === "sandstone" || tag === "limestone" || tag === "granite") return "stone";
  if (tag === "concrete" || tag === "reinforced_concrete" || tag === "concrete_blocks") return "concrete";
  if (tag === "wood" || tag === "wooden" || tag === "split_rail" || tag === "pole" || tag === "palisade") return "wood";
  if (tag === "metal" || tag === "steel" || tag === "iron" || tag === "chain_link" || tag === "railing" || tag === "bars" || tag === "metal_bars") return "metal";
  return "plain";
};

/** The longest straight piece a barrier's line is laid in (m). */
export const BARRIER_PIECE = 4;

/** Steps the variant keeps: the length in centimetres, the height in decimetres, the rise in centimetres. */
const LENGTH_STEPS = 511;
const HEIGHT_STEPS = 127;
const RISE_STEPS = 255;

export interface BarrierLayout {
  readonly kind: BarrierKind;
  /** Along the piece's +z, centred on its foot (m). */
  readonly length: number;
  /** Over the ground (m). */
  readonly height: number;
  /** How much higher the ground is at the piece's +z end than at its -z end (m). */
  readonly rise: number;
  readonly material: BarrierMaterial;
}

const clamp = (v: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, v));

/**
 * Kind in bits 0-2, length (cm) in bits 3-11, height (dm) in bits 12-18, rise (cm + 256) in bits
 * 19-27, material in bits 28-30.
 */
export const barrierVariant = (b: BarrierLayout): number =>
  BARRIER_KINDS.indexOf(b.kind) +
  8 * clamp(Math.round(b.length * 100), 0, LENGTH_STEPS) +
  4096 * clamp(Math.round(b.height * 10), 0, HEIGHT_STEPS) +
  524288 * (clamp(Math.round(b.rise * 100), -RISE_STEPS, RISE_STEPS) + 256) +
  268435456 * Math.max(0, BARRIER_MATERIALS.indexOf(b.material));

/** The barrier a variant holds. */
export const barrierLayout = (variant: number): BarrierLayout => ({
  kind: BARRIER_KINDS[variant & 7] ?? "wall",
  length: ((variant >> 3) & 511) / 100,
  height: ((variant >> 12) & 127) / 10,
  rise: (((variant >> 19) & 511) - 256) / 100,
  material: BARRIER_MATERIALS[(variant >> 28) & 7] ?? "plain",
});
