import type { StreetPropKind } from "./city-geo";

/**
 * The still crowd of the map city (ADR-0058 stage 8): street pieces of kind `figure`, a person in a
 * still pose at a piece of furniture, drawn only (no solid, so the simulation and its crowd stay as
 * they are). Its variant holds the pose, the build, the height of its seat and its look, so the
 * importer that places them, the simulation that keeps them with their furniture, the renderer that
 * draws them and the glitch scan read one layout.
 */

/**
 * The poses, as the models of `crowd-props.glb` have them: sitting, perched (sitting with the shins
 * under a seat that stands low over the paving), standing, standing with a hand on the hip, and
 * standing smoking (the standing model with an ember in its hand).
 */
export const FIGURE_POSES = ["sit", "perch", "stand", "hips", "smoke"] as const;
export type FigurePose = (typeof FIGURE_POSES)[number];
/** The two builds of the pack (a man's and a woman's), by letter: the look, not who they are. */
export const FIGURE_BODIES = ["a", "b"] as const;
export type FigureBody = (typeof FIGURE_BODIES)[number];

/**
 * How high the seat of a sitting model is over its soles, per pose and build (m): `extras.seat` of the
 * models of `crowd-props.glb` (an engine test pins them to the file).
 */
export const FIGURE_SEAT: Readonly<Record<"sit" | "perch", Readonly<Record<FigureBody, number>>>> = {
  sit: { a: 0.416, b: 0.378 },
  perch: { a: 0.296, b: 0.311 },
};

/** Looks per figure (its skin, clothes and hair are a function of it, `figure-models.ts`). */
export const FIGURE_LOOKS = 32;

export interface FigureLayout {
  readonly pose: FigurePose;
  readonly body: FigureBody;
  /** A sitter's seat over the piece's foot (m, centimetre steps up to 1.27); 0 for one standing. */
  readonly seat: number;
  readonly look: number;
}

/** Pose in bits 0-2, build in bit 3, seat (cm) in bits 4-10, look in bits 11-15. */
export const figureVariant = (f: FigureLayout): number =>
  FIGURE_POSES.indexOf(f.pose) + 8 * FIGURE_BODIES.indexOf(f.body) + 16 * Math.max(0, Math.min(127, Math.round(f.seat * 100))) + 2048 * (((f.look % FIGURE_LOOKS) + FIGURE_LOOKS) % FIGURE_LOOKS);

/** The figure a variant holds. */
export const figureLayout = (variant: number): FigureLayout => ({
  pose: FIGURE_POSES[variant & 7] ?? "stand",
  body: FIGURE_BODIES[(variant >> 3) & 1] ?? "a",
  seat: ((variant >> 4) & 127) / 100,
  look: (variant >> 11) & 31,
});

export const isSitting = (pose: FigurePose): pose is "sit" | "perch" => pose === "sit" || pose === "perch";

/**
 * The ground a figure takes, as circles in its frame (front +z, its piece's point at the origin): one
 * under a standing figure's feet (wider with the hands on the hips), and for a sitter one under its
 * hips and one under its knees and feet, in front of them.
 */
export const figureFootprint = (f: FigureLayout): readonly { readonly x: number; readonly z: number; readonly r: number }[] =>
  f.pose === "sit"
    ? [
        { x: 0, z: 0.05, r: 0.22 },
        { x: 0, z: 0.36, r: 0.2 },
      ]
    : f.pose === "perch"
      ? [
          { x: 0, z: 0.05, r: 0.22 },
          { x: 0, z: 0.3, r: 0.2 },
        ]
      : [{ x: 0, z: 0, r: f.pose === "hips" ? 0.3 : 0.24 }];

/**
 * A seat a figure may take on a piece of furniture, in the piece's frame (front +z): the middle of the
 * sitter's hips at (x, z), the top of the seat `top` over the piece's foot, the sitter facing the
 * piece's front turned by `turn`, its feet on `floor` over the foot (a café garden's deck).
 */
export interface FigureSeat {
  readonly x: number;
  readonly z: number;
  readonly top: number;
  readonly turn: number;
  readonly floor: number;
}

const seat = (x: number, z: number, top: number, turn = 0, floor = 0): FigureSeat => ({ x, z, top, turn, floor });

/**
 * The seats of the furniture as the renderer draws it (`prop-street.ts` `bench`, `prop-civic.ts`
 * `busShelter` and `cafeGarden`; an engine test checks each seat lies on its model): the slats of a
 * bench (0.45 m; the long ława seats three, the bench with a back two, a little forward of its back),
 * the bench of a bus shelter (0.48 m) and the stools round a café garden's two tables (0.52 m on its
 * 0.12 m deck), by shape.
 */
export const FIGURE_SEATS: Readonly<Partial<Record<StreetPropKind, (shape: number) => readonly FigureSeat[]>>> = {
  bench: (s) => (s === 0 ? [seat(-0.7, 0, 0.45), seat(0, 0, 0.45), seat(0.7, 0, 0.45)] : [seat(-0.45, -0.03, 0.45), seat(0.45, -0.03, 0.45)]),
  "bus-shelter": () => [seat(-0.7, -0.42, 0.48), seat(0, -0.42, 0.48), seat(0.7, -0.42, 0.48)],
  "cafe-garden": () => [seat(-1, -0.75, 0.52, 0, 0.12), seat(-1, 0.35, 0.52, Math.PI, 0.12), seat(1, -0.75, 0.52, 0, 0.12), seat(1, 0.35, 0.52, Math.PI, 0.12)],
};

/** Shapes per kind with seats (as `PROP_SHAPES` of the renderer): the seat's shape is `variant % shapes`. */
export const FIGURE_SEAT_SHAPES: Readonly<Partial<Record<StreetPropKind, number>>> = { bench: 2, "cafe-garden": 3 };

/**
 * The kinds a figure keeps to: the furniture with seats, and what people stand at (the food booths,
 * carts and market stalls they queue at, the stops they wait at, the doors they smoke by). A figure
 * stays only while a piece of these stands within `FIGURE_REACH` of it.
 */
export const FIGURE_HOSTS: ReadonlySet<StreetPropKind> = new Set(["bench", "bus-shelter", "cafe-garden", "food-stall", "food-cart", "market-stall", "bus-stop", "door"]);
export const FIGURE_REACH = 3;

/** A point of a piece's frame (its yaw turns +z towards +x) in the world. */
const placeOn = (host: { readonly x: number; readonly z: number; readonly yaw: number }, x: number, z: number): { x: number; z: number } => {
  const c = Math.cos(host.yaw);
  const s = Math.sin(host.yaw);
  return { x: host.x + x * c + z * s, z: host.z - x * s + z * c };
};

/** The seat of `host` whose hips' middle is within `tol` of (x, z), with its world point; or null. */
export const seatAt = (
  host: { readonly prop: StreetPropKind; readonly x: number; readonly z: number; readonly yaw: number; readonly variant: number },
  x: number,
  z: number,
  tol = 0.05,
): (FigureSeat & { readonly at: { readonly x: number; readonly z: number } }) | null => {
  for (const s of FIGURE_SEATS[host.prop]?.(host.variant % (FIGURE_SEAT_SHAPES[host.prop] ?? 1)) ?? []) {
    const at = placeOn(host, s.x, s.z);
    if (Math.hypot(at.x - x, at.z - z) <= tol) return { ...s, at };
  }
  return null;
};
